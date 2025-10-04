"""
Unit tests for health endpoint
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
class TestHealthEndpoint:
    """Test cases for the health check endpoint"""
    
    async def test_health_check_success(self):
        """Test that health endpoint returns 200 with correct response"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data == {"ok": True}
    
    async def test_health_check_method_not_allowed(self):
        """Test that health endpoint only accepts GET requests"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Test POST method
            response = await ac.post("/health")
            assert response.status_code == 405  # Method Not Allowed
            
            # Test PUT method
            response = await ac.put("/health")
            assert response.status_code == 405  # Method Not Allowed
            
            # Test DELETE method
            response = await ac.delete("/health")
            assert response.status_code == 405  # Method Not Allowed
    
    async def test_health_check_with_query_params(self):
        """Test that health endpoint works with query parameters (should be ignored)"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health?test=value&another=param")
            
            assert response.status_code == 200
            data = response.json()
            assert data == {"ok": True}
    
    async def test_health_check_with_headers(self):
        """Test that health endpoint works with various headers"""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            headers = {
                "User-Agent": "test-agent",
                "Accept": "application/json",
                "Authorization": "Bearer token"
            }
            response = await ac.get("/health", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data == {"ok": True}
