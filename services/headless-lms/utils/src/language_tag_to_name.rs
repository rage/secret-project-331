use std::collections::HashMap;

use once_cell::sync::Lazy;

pub static LANGUAGE_TAG_TO_NAME: Lazy<HashMap<&str, &str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("af", "afrikaans");
    map.insert("am", "amharic");
    map.insert("ar", "arabic");
    map.insert("arn", "mapudungun");
    map.insert("as", "assamese");
    map.insert("az", "azeri");
    map.insert("ba", "bashkir");
    map.insert("be", "belarusian");
    map.insert("my", "myanmar");
    map.insert("bg", "bulgarian");
    map.insert("bn", "bengali");
    map.insert("bo", "tibetan");
    map.insert("br", "breton");
    map.insert("bs", "bosnian");
    map.insert("ca", "catalan");
    map.insert("co", "corsican");
    map.insert("cs", "czech");
    map.insert("cy", "welsh");
    map.insert("da", "danish");
    map.insert("de", "german");
    map.insert("dsb", "lower sorbian");
    map.insert("dv", "divehi");
    map.insert("el", "greek");
    map.insert("en", "english");
    map.insert("es", "spanish");
    map.insert("et", "estonian");
    map.insert("eu", "basque");
    map.insert("fa", "persian");
    map.insert("fi", "finnish");
    map.insert("fil", "filipino");
    map.insert("fo", "faroese");
    map.insert("fr", "french");
    map.insert("fy", "frisian");
    map.insert("ga", "irish");
    map.insert("gd", "scottish");
    map.insert("gl", "galician");
    map.insert("gsw", "alsatian");
    map.insert("gu", "gujarati");
    map.insert("ha", "hausa");
    map.insert("he", "hebrew");
    map.insert("hi", "hindi");
    map.insert("hr", "croatian");
    map.insert("hsb", "upper sorbian");
    map.insert("hu", "hungarian");
    map.insert("hy", "armenian");
    map.insert("id", "indonesian");
    map.insert("ig", "igbo");
    map.insert("ii", "yi");
    map.insert("is", "icelandic");
    map.insert("it", "italian");
    map.insert("iu", "inuktitut");
    map.insert("ja", "japanese");
    map.insert("ka", "georgian");
    map.insert("kk", "kazakh");
    map.insert("kl", "greenlandic");
    map.insert("km", "khmer");
    map.insert("kn", "kannada");
    map.insert("ko", "korean");
    map.insert("kok", "konkani");
    map.insert("ky", "kyrgyz");
    map.insert("lb", "luxembourgish");
    map.insert("lo", "lao");
    map.insert("lt", "lithuanian");
    map.insert("lv", "latvian");
    map.insert("mi", "maori");
    map.insert("mk", "macedonian");
    map.insert("ml", "malayalam");
    map.insert("mn", "mongolian");
    map.insert("moh", "mohawk");
    map.insert("mr", "marathi");
    map.insert("ms", "malay");
    map.insert("mt", "maltese");
    map.insert("nb", "norwegian");
    map.insert("ne", "nepali");
    map.insert("nl", "dutch");
    map.insert("nn", "norwegian");
    map.insert("no", "norwegian");
    map.insert("nso", "sesotho");
    map.insert("oc", "occitan");
    map.insert("or", "oriya");
    map.insert("pa", "punjabi");
    map.insert("pl", "polish");
    map.insert("prs", "dari");
    map.insert("ps", "pashto");
    map.insert("pt", "portuguese");
    map.insert("qut", "k'iche");
    map.insert("quz", "quechua");
    map.insert("rm", "romansh");
    map.insert("ro", "romanian");
    map.insert("ru", "russian");
    map.insert("rw", "kinyarwanda");
    map.insert("sa", "sanskrit");
    map.insert("sah", "yakut");
    map.insert("se", "sami");
    map.insert("si", "sinhala");
    map.insert("sk", "slovak");
    map.insert("sl", "slovenian");
    map.insert("sma", "sami");
    map.insert("smj", "sami");
    map.insert("smn", "sami");
    map.insert("sms", "sami");
    map.insert("sq", "albanian");
    map.insert("sr", "serbian");
    map.insert("sv", "swedish");
    map.insert("sw", "kiswahili");
    map.insert("syr", "syriac");
    map.insert("ta", "tamil");
    map.insert("te", "telugu");
    map.insert("tg", "tajik");
    map.insert("th", "thai");
    map.insert("tk", "turkmen");
    map.insert("tn", "setswana");
    map.insert("tr", "turkish");
    map.insert("tt", "tatar");
    map.insert("tzm", "tamazight");
    map.insert("ug", "uyghur");
    map.insert("uk", "ukrainian");
    map.insert("ur", "urdu");
    map.insert("uz", "uzbek");
    map.insert("vi", "vietnamese");
    map.insert("wo", "wolof");
    map.insert("xh", "isixhosa");
    map.insert("yo", "yoruba");
    map.insert("zh", "chinese");
    map.insert("zu", "isizulu");
    map.insert("my", "myanmar ");

    map
});
