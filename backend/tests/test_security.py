import unittest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from main import app
from security import require_user, rate_limit, _buckets
from routes import chat, feedback

client = TestClient(app)
VALID = {'messages': [{'role': 'user', 'content': 'Explain this passage'}]}
UID = '00000000-0000-4000-8000-000000000001'

class SecurityTests(unittest.TestCase):
    def setUp(self):
        _buckets.clear()
        app.dependency_overrides.clear()
    def tearDown(self):
        app.dependency_overrides.clear()
    def authenticated(self):
        app.dependency_overrides[require_user] = lambda: UID
    def test_ai_requires_server_identity(self):
        with patch.object(chat.requests, 'post') as provider:
            self.assertEqual(client.post('/api/chat', json=VALID).status_code, 401)
            provider.assert_not_called()
    def test_invalid_session_rejected(self):
        with patch('security.requests.get', return_value=Mock(status_code=401)), patch.object(chat.requests, 'post') as provider:
            self.assertEqual(client.post('/api/chat', json=VALID, headers={'Authorization':'Bearer invalid','X-Supabase-Key':'public-test'}).status_code,401)
            provider.assert_not_called()
    def test_guest_or_unverified_rejected(self):
        for user in ({'id':UID,'is_anonymous':True}, {'id':UID,'email_confirmed_at':None}):
            with patch('security.requests.get', return_value=Mock(status_code=200, json=Mock(return_value=user))):
                self.assertEqual(client.post('/api/chat', json=VALID,headers={'Authorization':'Bearer test','X-Supabase-Key':'public-test'}).status_code,403)
    def test_field_tampering_and_size(self):
        self.authenticated()
        for payload in ({**VALID,'admin':True},{**VALID,'max_tokens':999999},{'messages':[{'role':'system','content':'tamper'}]},{'messages':[{'role':'user','content':'x'*16001}]}):
            self.assertEqual(client.post('/api/chat',json=payload).status_code,422)
        self.assertEqual(client.post('/api/chat',content='x'*262145).status_code,413)
    def test_model_is_server_controlled_and_responses_minimal(self):
        self.authenticated()
        result=Mock(status_code=200,json=Mock(return_value={'choices':[{'message':{'content':'Hello'}}],'internal':'secret'}))
        with patch.object(chat,'load_api_key',return_value='server-only'), patch.object(chat.requests,'post',return_value=result) as provider:
            response=client.post('/api/chat',json={**VALID,'model':'expensive-injected-model'})
            self.assertEqual(response.json(),{'content':[{'type':'text','text':'Hello'}]})
            self.assertEqual(provider.call_args.kwargs['json']['model'],chat.DEFAULT_MODEL)
            self.assertEqual(provider.call_args.kwargs['json']['provider'],{'data_collection':'deny'})
    def test_retired_shared_record_routes(self):
        for path in ('/api/upload','/api/progress','/docs','/openapi.json'):
            self.assertEqual(client.get(path).status_code,404)
    def test_feedback_requires_consent_and_blocks_trap(self):
        for data,status in (({'message':'hello','consent':False},422),({'message':'hello','consent':True,'website':'bot'},400),({'message':'hello','consent':True,'reply_email':'invalid'},422)):
            with patch.object(feedback.requests,'post') as database:
                self.assertEqual(client.post('/api/feedback',json=data).status_code,status)
                database.assert_not_called()
    def test_feedback_sends_only_allowed_fields(self):
        with patch.object(feedback.requests,'post',return_value=Mock(status_code=201)) as database:
            response=client.post('/api/feedback',json={'message':'Privacy question','consent':True},headers={'X-Supabase-Key':'public-test'})
            self.assertEqual(response.status_code,200)
            self.assertEqual(database.call_args.kwargs['json'],{'message':'Privacy question','name':'Anonymous','user_id':None})
    def test_captcha_enforced_when_configured(self):
        import os
        with patch.dict(os.environ, {'TURNSTILE_SECRET_KEY':'test-secret'}), patch.object(feedback.requests,'post',return_value=Mock(status_code=200,json=Mock(return_value={'success':False}))) as provider:
            response=client.post('/api/feedback',json={'message':'hello','consent':True},headers={'X-Supabase-Key':'public-test'})
            self.assertEqual(response.status_code,400)
            self.assertEqual(provider.call_count,1)
            self.assertIn('siteverify',provider.call_args.args[0])
    def test_rate_limit_and_headers(self):
        rate_limit('test',1,60)
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as error: rate_limit('test',1,60)
        self.assertEqual(error.exception.status_code,429)
        response=client.get('/health',headers={'Origin':'https://shhhhh-ten.vercel.app'})
        self.assertEqual(response.headers['x-content-type-options'],'nosniff')
        self.assertEqual(response.headers['access-control-allow-origin'],'https://shhhhh-ten.vercel.app')
        response=client.get('/health',headers={'Origin':'https://untrusted.vercel.app'})
        self.assertNotIn('access-control-allow-origin',response.headers)

if __name__ == '__main__': unittest.main()
