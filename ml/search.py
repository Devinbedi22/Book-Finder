import numpy as np 
import pandas as pd 
from rapidfuzz import process
import random


class SearchBook:

    def __init__(self):
        self.book_df = pd.read_csv('C:\\Users\\kaavy\\OneDrive\\Desktop\\Mini-Reads\\recommendation\\recommender_df.csv')
        self.generic_df = self.book_df.sort_values(by = 'weighted_rating', ascending = False).head(1000)

    def search_by_title(self, query):
        matches = [match[0] for match in process.extract(query, self.book_df['title'], limit = 15, processor=str.lower)]
        
        temp_df = self.book_df[self.book_df['title'].isin(matches)]
        result = []
        for _, row in temp_df.iterrows():
            result.append({
                'title': row['title'],
                'author': row['author']
            })
        return result 

    def expand_book(self, book_title):
        book = self.book_df[self.book_df['title'] == book_title]
        result = {}
        result['title'] = book['title'].iloc[0]
        result['author'] = book['author'].iloc[0]
        result['description'] = book['description'].iloc[0]
        result['genres'] = book['genres'].iloc[0]
        result['rating'] = book['weighted_rating'].iloc[0]
        result['coverImg'] = book['coverImg'].iloc[0]
        return result


    def search_by_author(self, query):
        matches = [match[0] for match in process.extract(query, self.book_df['author'], limit = 15, processor=str.lower)]   
        result = []
        for _, row in self.book_df[self.book_df['author'].isin(matches)].iterrows():
            result.append({
                'title': row['title'],
                'author': row['author']
            })
        return result

    def search_by_genre(self, query):
        result = []
        for genre in query:
            cnt = 0
            for _, row in self.book_df.iterrows():
                if genre in row['genres']:
                    cnt += 1
                    result.append({
                        'title': row['title'],
                        'author': row['author']
                    })
                if cnt == 15:
                    break
        n = len(result)
        if len(result) > 15:
            result = random.sample(result, 15)

        return result
    

    def general_recommendations(self, genres):
        result = []
        duplicates = []
        for genre in genres:
            match = [match[0] for match in process.extract(genre, self.generic_df['genres'], limit = 50, processor=str.lower)]
            temp_df = self.generic_df[self.generic_df['genres'].isin(match)]
            for _, row in temp_df.iterrows():
                if row['title'] not in duplicates:
                    result.append({
                        'title': row['title'],
                        'author': row['author'],
                    })
                    duplicates.append(row['title'])
        n = len(result)
        if (n > 50):
            result = random.sample(result, 50)
        
        final_result = []
        for book in result:
            book_title = book['title']
            book_details = self.expand_book(book_title)
            final_result.append(book_details)

        sorted_result = sorted(final_result, key = lambda x: x['rating'], reverse = True)
        return final_result[:50]

