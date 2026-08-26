import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    url = "postgresql+asyncpg://ams_auth:ams_auth@localhost:5432/ams_auth"
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            print("Successfully connected to ams_auth")
            # List tables
            query = text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            result = await conn.execute(query)
            print(f"Tables: {[row[0] for row in result.fetchall()]}")
    except Exception as e:
        print(f"Error connecting to ams_auth: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
