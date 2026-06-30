"""
Unit tests for app/auth.py — pure functions only, no database or HTTP.

Covers:
- hash_password / verify_password (including the 72-char truncation edge case)
- create_access_token / create_refresh_token / decode_token round-trips
- decode_token failure paths (tampered, wrong key, expired)
- revoke_token / is_token_revoked lifecycle
"""

import pytest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import jwt

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)


# ─── hash_password / verify_password ─────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        assert hash_password("secret") != "secret"

    def test_correct_password_verifies(self):
        hashed = hash_password("correct_horse")
        assert verify_password("correct_horse", hashed) is True

    def test_wrong_password_does_not_verify(self):
        hashed = hash_password("correct_horse")
        assert verify_password("wrong_horse", hashed) is False

    def test_empty_password_hashes_and_verifies(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_hash_is_non_deterministic_same_input_different_output(self):
        """bcrypt uses a random salt; two calls on the same input should differ."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2

    def test_72_char_truncation_makes_differing_suffixes_verify_interchangeably(self):
        """
        Both hash_password and verify_password truncate to 72 chars before
        hashing.  Two passwords that share the first 72 characters must verify
        against each other's hash.
        """
        base = "x" * 72
        password_a = base + "IGNORED_SUFFIX_A"
        password_b = base + "IGNORED_SUFFIX_B"
        hashed = hash_password(password_a)
        assert verify_password(password_b, hashed) is True

    def test_password_differing_within_72_chars_does_not_verify(self):
        password_a = "a" * 71 + "A"
        password_b = "a" * 71 + "B"
        hashed = hash_password(password_a)
        assert verify_password(password_b, hashed) is False


# ─── JWT round-trip ───────────────────────────────────────────────────────────

class TestJWTCreation:
    def test_access_token_has_type_access(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        assert decode_token(token)["token_type"] == "access"

    def test_refresh_token_has_type_refresh(self):
        token = create_refresh_token({"user_id": "u1", "email": "a@b.com"})
        assert decode_token(token)["token_type"] == "refresh"

    def test_decoded_payload_contains_user_id_and_email(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        payload = decode_token(token)
        assert payload["user_id"] == "u1"
        assert payload["email"] == "a@b.com"

    def test_sub_is_derived_from_user_id_when_absent(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        assert decode_token(token)["sub"] == "u1"

    def test_explicit_sub_is_preserved_over_user_id(self):
        token = create_access_token(
            {"user_id": "u1", "sub": "explicit_sub", "email": "a@b.com"}
        )
        assert decode_token(token)["sub"] == "explicit_sub"

    def test_token_carries_a_non_empty_jti(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        jti = decode_token(token).get("jti", "")
        assert len(jti) > 0

    def test_successive_tokens_have_distinct_jtis(self):
        data = {"user_id": "u1", "email": "a@b.com"}
        jti1 = decode_token(create_access_token(data))["jti"]
        jti2 = decode_token(create_access_token(data))["jti"]
        assert jti1 != jti2

    def test_access_token_exp_is_in_the_future(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        exp = decode_token(token)["exp"]
        # jose returns exp as a Unix timestamp (int)
        assert exp > datetime.now(timezone.utc).timestamp()

    def test_refresh_token_exp_is_further_than_access_token_exp(self):
        data = {"user_id": "u1", "email": "a@b.com"}
        access_exp = decode_token(create_access_token(data))["exp"]
        refresh_exp = decode_token(create_refresh_token(data))["exp"]
        assert refresh_exp > access_exp


# ─── decode_token failure paths ───────────────────────────────────────────────

class TestDecodeTokenFailures:
    def test_tampered_signature_raises_401(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(HTTPException) as exc:
            decode_token(tampered)
        assert exc.value.status_code == 401

    def test_wrong_signing_key_raises_401(self):
        token = jwt.encode(
            {
                "sub": "u1",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            "wrong-secret-key",
            algorithm=ALGORITHM,
        )
        with pytest.raises(HTTPException) as exc:
            decode_token(token)
        assert exc.value.status_code == 401

    def test_expired_token_raises_401(self):
        token = jwt.encode(
            {
                "sub": "u1",
                "user_id": "u1",
                "exp": datetime.now(timezone.utc) - timedelta(seconds=30),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        with pytest.raises(HTTPException) as exc:
            decode_token(token)
        assert exc.value.status_code == 401

    def test_completely_invalid_string_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            decode_token("not.a.valid.jwt")
        assert exc.value.status_code == 401

    def test_empty_string_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            decode_token("")
        assert exc.value.status_code == 401


# ─── revoke_token / is_token_revoked ─────────────────────────────────────────

class TestTokenRevocation:
    # Note: the _reset_revoked_jtis autouse fixture (conftest.py) clears the
    # global _REVOKED_JTIS set before and after every test.

    def test_unknown_jti_is_not_revoked(self):
        assert is_token_revoked("some-jti-that-was-never-revoked") is False

    def test_revoked_jti_is_revoked(self):
        revoke_token("jti-abc")
        assert is_token_revoked("jti-abc") is True

    def test_revocation_does_not_affect_other_jtis(self):
        revoke_token("jti-one")
        assert is_token_revoked("jti-two") is False

    def test_multiple_jtis_can_be_revoked_independently(self):
        revoke_token("jti-alpha")
        revoke_token("jti-beta")
        assert is_token_revoked("jti-alpha") is True
        assert is_token_revoked("jti-beta") is True
        assert is_token_revoked("jti-gamma") is False

    def test_autouse_fixture_clears_revocations_between_tests(self):
        """
        Verify that the autouse reset fixture works: 'jti-abc' was revoked in
        the previous test but should not be revoked here.
        """
        assert is_token_revoked("jti-abc") is False
