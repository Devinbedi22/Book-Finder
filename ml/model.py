import pandas as pd 
import numpy as np 
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.output_parsers import StrOutputParser
from sentence_transformers import SentenceTransformer
from langchain.vectorstores.cassandra import Cassandra
from langchain.indexes.vectorstore import VectorStoreIndexWrapper
from langchain_community.embeddings import HuggingFaceEmbeddings 

import cassio

from serpapi import GoogleSearch


import os 

load_dotenv()
os.environ['HF_TOKEN'] = os.getenv('HF_TOKEN')


class BookRecommendation:
    def __init__(self):
        self.recommender_df = pd.read_csv('C:\\Users\\kaavy\\OneDrive\\Desktop\\Mini-Reads\\recommendation\\recommender_df.csv')
       
        self.vector_db = self.initialize_vector_db()
        llm = ChatGroq(model = 'llama-3.3-70b-versatile', groq_api_key = os.getenv("GROQ_API_KEY"))
        search_prompt = PromptTemplate.from_template(
            '''You are a helpul assistant tasked with retrieving information about the 
                given book based on it's title.
                <title>
                    {title}
                </title>
                Additionally, please refer to the following internet search results about the 
                book to curate the information about it.
                <search_results>
                {search_results}
                </search_results>

                **Ensure the result to be in the following output format**
                title : book title
                author : book author 
                genre : genre of the book
                description : short one line description about the book
            '''
        )
        self.chain = search_prompt | llm | StrOutputParser()

    
    def search_book_information(self, book_title):
        

        query = "No result..."
    
        book_info = self.chain.invoke({'title': book_title, 'search_results': query})
        return book_info
    

    def initialize_vector_db(self):
        ASTRA_DB_APPLICATION_TOKEN = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
        ASTRA_DB_ID = os.getenv("ASTRA_DB_ID")
        cassio.init(
            token = ASTRA_DB_APPLICATION_TOKEN,
            database_id = ASTRA_DB_ID
        )
        embedding_model2 = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2") 
        astra_vector_store = Cassandra(
            embedding = embedding_model2,
            table_name = 'book_recommendation',
            session = None,
            keyspace = None
        )

        astra_vector_index = VectorStoreIndexWrapper(vectorstore = astra_vector_store)
        return astra_vector_store
    
    def search_books(self, book):
        book_info = self.search_book_information(book)
        result = self.vector_db.similarity_search_with_score(book_info, k = 20)
        book_ids = []
        for i in range(len(result)):
            book_ids.append(result[i][0].id)
        recommendations = []
        for id in book_ids:
            matching_books = self.recommender_df[self.recommender_df['bookId'] == id]

            if matching_books.empty:
                continue 

            recommendations.append({
                'title': matching_books['title'].values[0],
                'author': matching_books['author'].values[0],
                'description': matching_books['description'].values[0],
                'ratings': matching_books['numRatings'].values[0]
            })
        recommendations = sorted(recommendations, key = lambda x : x['ratings'], reverse = True)
        return recommendations[:5] 


    def get_recommendations(self, books):
         
        all_recommendations = []
        for book in books:
            all_recommendations.extend(self.search_books(book))

        all_recommendations = sorted(all_recommendations, key = lambda x : x['ratings'], reverse = True)

        final_result = []
        for i in range(len(all_recommendations)):
            curr_recommendation = all_recommendations[i]
            final_result.append({
                'title' : str(curr_recommendation['title']),
                'author' : str(curr_recommendation['author']),
                'description' : str(curr_recommendation['description'])[:250] + "..."
            })
        return final_result 
    




    

    


        

    
    
    
