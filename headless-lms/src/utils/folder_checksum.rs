/*!
Provides functionality for checksumming directory trees.

This is meant for checking whether a exercise in a exercise template repository
has changed after a refresh.
*/

use std::{fs::Permissions, path::Path, u32};

use anyhow::Result;
use blake3::Hash;
use futures::StreamExt;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use tokio::{fs::File, io::BufReader};
use tokio_util::io::ReaderStream;
use walkdir::WalkDir;

/**
Recursively hashes a folder returning a checksum.

The hashing function takes into account all files, folders, and symlinks. All
contents, the file type, and the unix file mode are included as well.

Please note that if you have very large files in the directory, the running time
might take a while since reading a lot of data from disk is not fast.
*/
pub async fn hash_folder(root_path: &Path) -> Result<Hash> {
    // Blake3 hasher lets us build the hash incrementally, avoiding the need to load everything to be hashed to memory at once.
    let mut hasher = blake3::Hasher::new();

    let walker = WalkDir::new(root_path)
        // Instead of following a symbolic link, we just hash the link itself.
        // Following the link would lead to recursion problems.
        .follow_links(false)
        .max_open(10)
        .contents_first(false)
        // Paths are sorted to make sure we process them in the same order on all systems.
        .sort_by_file_name();
    // Note that the filesystem operations used for walking the tree are executed synchronously.
    // This is because the walkdir library has no async support at the moment.
    for entry in walker {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let file_type = metadata.file_type();
        let permissions = metadata.permissions();
        let full_path = entry.path();

        // Metadata to be included in the hash
        let directory = file_type.is_dir();
        let file = file_type.is_file();
        let symlink = file_type.is_symlink();
        let permissions_mode = determine_permissions_mode_for_hashing(&permissions);
        let relative_path = full_path.strip_prefix(root_path)?;

        // The extra separators at the end and at the beginning are to prevent
        // accidental collisions in the hashed string.
        let serialized_metadata = format!(
            "-{}{}{}{}{:?}-",
            directory as u8, file as u8, symlink as u8, &permissions_mode, &relative_path
        );

        hasher.update(serialized_metadata.as_bytes());

        if file {
            let file = File::open(full_path).await?;
            // We read the file contents with a bufreader so that handling really big files wouldn't cause us problems.
            let reader = BufReader::new(file);
            let mut stream = ReaderStream::new(reader);
            while let Some(chunk) = stream.next().await {
                hasher.update(&chunk?);
            }
        }
        if symlink {
            let res = tokio::fs::read_link(full_path).await?;
            // Only relative links would work here since the files should origitate from a remote repository
            // so relativizing this would be pointless.
            hasher.update(res.display().to_string().as_bytes());
        }
    }
    let hash = hasher.finalize();
    Ok(hash)
}

fn determine_permissions_mode_for_hashing(permissions: &Permissions) -> u32 {
    if cfg!(unix) {
        return permissions.mode();
    }
    // Default implementation for mostly windows that has no unix like modes.
    // Another approach here could be to pull the file mode from git.
    if permissions.readonly() {
        return 0o444;
    }
    return 0o644;
}

#[cfg(test)]
mod tests {
    use tempdir::TempDir;
    use tokio::{
        fs::{self, create_dir, remove_dir, symlink},
        io::AsyncWriteExt,
    };

    use super::*;

    #[cfg(not(target_os = "windows"))]
    #[actix_rt::test]
    async fn it_works() {
        let dir = TempDir::new("test-folder-checksum").expect("Failed to create a temp dir");
        let first_hash = hash_folder(&dir.path()).await.unwrap();
        assert_eq!(
            first_hash.to_hex().to_string(),
            "01444ae9678097d0214e449568b68eb351c4743b2697bfc3d517b5c601535823"
        );
        let mut file = File::create(dir.path().join("test-file")).await.unwrap();
        file.write_all(b"Test file").await.unwrap();

        let second_hash = hash_folder(&dir.path()).await.unwrap();

        assert_eq!(
            second_hash.to_hex().to_string(),
            "c2f4caaaafeb41dfd5e5381ea9c1583ccaa7d09378745def8c979b1e1f0e5c2a"
        );

        let mut permissions = file.metadata().await.unwrap().permissions();
        permissions.set_readonly(true);

        fs::set_permissions(dir.path().join("test-file"), permissions)
            .await
            .unwrap();

        let third_hash = hash_folder(&dir.path()).await.unwrap();

        assert_eq!(
            third_hash.to_hex().to_string(),
            "1b1820abcb400974e0eb751c103303864f7b0ae7ad387c5135521d9968dbb4de"
        );

        create_dir(&dir.path().join("directory")).await.unwrap();

        let fourth_hash = hash_folder(&dir.path()).await.unwrap();

        assert_eq!(
            fourth_hash.to_hex().to_string(),
            "f1113337a98c5fe5d7ed0f2a9fc17490993b1149ea44784a027e53d1a1884c9e"
        );

        remove_dir(&dir.path().join("directory")).await.unwrap();

        let fifth_hash = hash_folder(&dir.path()).await.unwrap();

        assert_eq!(
            fifth_hash.to_hex().to_string(),
            "1b1820abcb400974e0eb751c103303864f7b0ae7ad387c5135521d9968dbb4de"
        );

        // Should not have the same checksum as with the directory created before
        File::create(&dir.path().join("directory")).await.unwrap();
        let sixth_hash = hash_folder(&dir.path()).await.unwrap();

        assert_eq!(
            sixth_hash.to_hex().to_string(),
            "28708cf92385c9da899ddf346baed1b61a300ae0d8aa2fa2468789860a4cb425"
        );

        symlink(&Path::new("directory"), &dir.path().join("symlink"))
            .await
            .unwrap();

        let seventh_hash = hash_folder(&dir.path()).await.unwrap();
        assert_eq!(
            seventh_hash.to_hex().to_string(),
            "5144015ff90807ec6448a0b6bfcc470de495182441e0af019c6483da8edaa05c"
        );
    }
}
