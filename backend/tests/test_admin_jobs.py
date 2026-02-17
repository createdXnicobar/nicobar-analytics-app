"""
Unit tests for admin jobs endpoints
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings

class TestMatchTodayEndpoint:
    __test__ = True

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_today_without_any_header():
        """Test that jobs match today without any header returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-today")
            assert response.status_code == 422 # Unprocessable Entity
            error_data = response.json()
            assert "detail" in error_data
            errors = error_data["detail"]
            assert len(errors) == 1
            assert "x-admin-token" in error_data["detail"][0]["loc"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_today_with_empty_admin_token():
        """Test that jobs match today with empty admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-today", headers={"x-admin-token": ""})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_today_with_incorrect_admin_token():
        """Test that jobs match today with incorrect admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-today", headers={"x-admin-token": "incorrect-token"})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

class TestAggregateTodayEndpoint:
    __test__ = True

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_today_without_any_header():
        """Test that jobs aggregate today without any header returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-today")
            assert response.status_code == 422 # Unprocessable Entity
            error_data = response.json()
            assert "detail" in error_data
            errors = error_data["detail"]
            assert len(errors) == 1
            assert "x-admin-token" in error_data["detail"][0]["loc"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_today_with_empty_admin_token():
        """Test that jobs aggregate today with empty admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-today", headers={"x-admin-token": ""})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_today_with_incorrect_admin_token():
        """Test that jobs aggregate today with incorrect admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-today", headers={"x-admin-token": "incorrect-token"})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

class TestMatchYesterdayEndpoint:
    __test__ = True
    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_yesterday_without_any_header():
        """Test that jobs match yesterday without any header returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-yesterday")
            assert response.status_code == 422 # Unprocessable Entity
            error_data = response.json()
            assert "detail" in error_data
            errors = error_data["detail"]
            assert len(errors) == 1
            assert "x-admin-token" in error_data["detail"][0]["loc"]
    
    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_yesterday_with_empty_admin_token():
        """Test that jobs match yesterday with empty admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-yesterday", headers={"x-admin-token": ""})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_yesterday_with_incorrect_admin_token():
        """Test that jobs match yesterday with incorrect admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match-yesterday", headers={"x-admin-token": "incorrect-token"})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

class TestAggregateYesterdayEndpoint:
    __test__ = True

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_yesterday_without_any_header():
        """Test that jobs aggregate yesterday without any header returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-yesterday")
            assert response.status_code == 422 # Unprocessable Entity
            error_data = response.json()
            assert "detail" in error_data
            errors = error_data["detail"]
            assert len(errors) == 1
            assert "x-admin-token" in error_data["detail"][0]["loc"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_yesterday_with_empty_admin_token():
        """Test that jobs aggregate yesterday with empty admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-yesterday", headers={"x-admin-token": ""})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_aggregate_yesterday_with_incorrect_admin_token():
        """Test that jobs aggregate yesterday with incorrect admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/aggregate-yesterday", headers={"x-admin-token": "incorrect-token"})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]


class TestMatchEndpoint:
    __test__ = True

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_without_any_header_and_without_date():
        """Test that jobs match today without any header returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match")
            assert response.status_code == 422 # Unprocessable Entity
            error_data = response.json()
            assert "detail" in error_data
            errors = error_data["detail"]
            assert len(errors) == 2

            missing_fields = []

            for error in error_data["detail"]:
                missing_fields.append(error["loc"][-1])

            assert "x-admin-token" in missing_fields
            assert "date" in missing_fields

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_with_empty_admin_token():
        """Test that jobs match today with empty admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match", headers={"x-admin-token": ""})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]

    @staticmethod
    @pytest.mark.asyncio 
    async def test_match_with_incorrect_admin_token():
        """Test that jobs match today with incorrect admin token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            
            response = await ac.post("/jobs/match", headers={"x-admin-token": "incorrect-token"})
            assert response.status_code == 401
            error_data = response.json()
            assert "detail" in error_data
            assert "Unauthorized" == error_data["detail"]
