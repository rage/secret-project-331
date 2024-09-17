from fastapi import FastAPI
from sentence_transformers import SentenceTransformer
from torch import Tensor

model = SentenceTransformer('intfloat/multilingual-e5-large')

app = FastAPI()


@app.get("/")
async def root():
    query_embedding = model.encode("query: What was the thing that my connection was dropping like crazy?")
    passage_embeddings = model.encode([
        "passage: Telecommunications rely on building blocks and concepts for which acronyms are used. The field is full of acronyms and you will encounter these on the course. Our approach is to present the key concepts and avoid unnecessary terminology while giving the essential information for understanding these technologies. We've provided a glossary for the key terms to help you get acquainted with them, to which you can also refer once you complete the course to quickly recall the meaning of different terms.",
        "passage: Multiconnectivity entitles a user to connect to multiple nodes simultaneously using the same or even different radio access technologies (for example LTE, WiFi, 5G NR). Through concurrently using the independent communication paths and resources of the different nodes, this becomes possible to boost the peak data rate, reduce the latency, or improve the reliability of wireless communication.",
        "passage: A SIM card stores important information including a 15-digit number called the International Mobile Subscriber Identity (IMSI), a unique serial number, security-related information, a list of services accessible to the user, contact book information, text messages – Short Message Service (SMS) text messages – and the personal identification number (PIN) code for accessing the card and the Personal Unblocking Key (PUK) for unlocking the card when the PIN has been entered too many times incorrectly resulting in the locking of the card. "
    ])

    similarity: Tensor = model.similarity(query_embedding, passage_embeddings)
    # print dimensions of the tensors
    print(query_embedding.shape)
    print(passage_embeddings.shape)
    print(similarity.shape)
    return {"similarity": similarity.tolist(),}
