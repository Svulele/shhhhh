import re
import unittest
from cors_config import cors_settings

class CorsTests(unittest.TestCase):
    def test_production_never_has_preview_pattern_or_wildcard(self):
        for mode in ('production', 'prod', '', 'unexpected'):
            settings = cors_settings({'APP_ENV': mode, 'FRONTEND_ORIGINS': '*,https://example.com'})
            self.assertIsNone(settings['allow_origin_regex'])
            self.assertNotIn('*', settings['allow_origins'])
        self.assertIsNone(cors_settings({})['allow_origin_regex'])
    def test_preview_pattern_only_accepts_project_and_owner_https_origins(self):
        for mode in ('preview','staging','test','development'):
            settings = cors_settings({'APP_ENV': mode})
            regex=settings['allow_origin_regex']
            self.assertTrue(re.fullmatch(regex, 'https://shhhhh-g0295udiu-svulele.vercel.app'))
            for origin in ('https://evil.vercel.app','https://shhhhh-abc-other.vercel.app','http://shhhhh-abc-svulele.vercel.app','https://shhhhh-abc-svulele.vercel.app.evil.test'):
                self.assertIsNone(re.fullmatch(regex,origin))
