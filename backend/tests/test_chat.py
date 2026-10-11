import unittest
from unittest.mock import patch, Mock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routes import chat
from security import require_user

app = FastAPI()
app.include_router(chat.router, prefix='/api/chat')
app.dependency_overrides[require_user] = lambda: 'test-user'
client = TestClient(app)

class ChatResponseTests(unittest.TestCase):
    def request(self, payload):
        response = Mock(status_code=200)
        response.json.return_value = payload
        with patch.object(chat, 'load_api_key', return_value='test-only'), patch.object(chat.requests, 'post', return_value=response):
            return client.post('/api/chat', json={'messages':[{'role':'user','content':'Test'}]})

    def test_malformed_success_is_controlled_error(self):
        for payload in ({}, {'choices':[]}, {'choices':[{'message':None}]}, {'choices':[{'message':{'content':None}}]}):
            with self.subTest(payload=payload):
                response = self.request(payload)
                self.assertEqual(response.status_code, 502)
                self.assertIn('could not provide an answer', response.json()['detail'])

    def test_text_and_content_blocks(self):
        for content in ('Hello', [{'type':'text','text':'Hello'}]):
            response = self.request({'choices':[{'message':{'content':content}}]})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['content'][0]['text'], 'Hello')

if __name__ == '__main__':
    unittest.main()
