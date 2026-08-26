import asyncio
import re
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def try_connect(base_url, ports=[5432, 5433]):
    last_error = None
    for port in ports:
        # Replace port in URL
        url = re.sub(r':\d+/', f':{port}/', base_url)
        if ':' not in base_url.split('@')[1].split('/')[0]:
             # If no port specified in base_url, add it
             url = base_url.replace('/localhost/', f'/localhost:{port}/').replace('/127.0.0.1/', f'/127.0.0.1:{port}/')

        engine = create_async_engine(url)
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return engine, url
        except Exception as e:
            last_error = e
            await engine.dispose()
            continue
    raise Exception(f"Could not connect to {base_url} on ports {ports}. Last error: {last_error}")

async def wipe_business(engine):
    print("--- Wiping ams_business ---")
    async with engine.begin() as conn:
        query = text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name != 'alembic_version';
        """)
        result = await conn.execute(query)
        tables = [row[0] for row in result.fetchall()]
        if not tables:
            print("No tables found to wipe in ams_business.")
            return

        print(f"Found {len(tables)} tables. Truncating...")
        # TRUNCATE TABLE T1, T2, ... CASCADE;
        await conn.execute(text(f"TRUNCATE TABLE {', '.join(tables)} CASCADE;"))

        # Verification
        print("Verifying ams_business wipe...")
        for table in tables[:5]: # Check first 5 tables
            count_res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = count_res.scalar()
            print(f"  Table {table}: {count} rows")
    print("ams_business wipe complete.")

async def wipe_auth(engine):
    print("--- Wiping ams_auth ---")
    async with engine.begin() as conn:
        # Get all tables except flyway_schema_history
        query = text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name != 'flyway_schema_history';
        """)
        result = await conn.execute(query)
        tables = [row[0] for row in result.fetchall()]

        if not tables:
            print("No tables found to wipe in ams_auth.")
            return

        print(f"Found {len(tables)} tables in ams_auth. Truncating...")
        # TRUNCATE TABLE T1, T2, ... CASCADE;
        await conn.execute(text(f"TRUNCATE TABLE {', '.join(tables)} CASCADE;"))

        # Verification
        user_count = await conn.execute(text("SELECT COUNT(*) FROM app_user"))
        print(f"  Users remaining: {user_count.scalar()}")
    print("ams_auth wipe complete.")

async def flush_redis(redis_url):
    print(f"--- Flushing Redis at {redis_url} ---")
    try:
        r = redis.from_url(redis_url)
        await r.flushall()
        print("Redis flushed successfully.")
        await r.aclose()
    except Exception as e:
        print(f"Error flushing Redis: {e}")

async def main():
    business_url = "postgresql+asyncpg://ams_business:ams_business@localhost:5432/ams_business"
    auth_url = "postgresql+asyncpg://ams_auth:ams_auth@localhost:5432/ams_auth"
    redis_url = "redis://localhost:6379/0"

    print("Starting COMPLETE data wipe...")

    try:
        b_engine, b_url = await try_connect(business_url)
        print(f"Connected to Business DB at {b_url}")
        await wipe_business(b_engine)
        await b_engine.dispose()
    except Exception as e:
        print(f"CRITICAL ERROR (Business DB): {e}")

    try:
        a_engine, a_url = await try_connect(auth_url)
        print(f"Connected to Auth DB at {a_url}")
        await wipe_auth(a_engine)
        await a_engine.dispose()
    except Exception as e:
        print(f"CRITICAL ERROR (Auth DB): {e}")

    await flush_redis(redis_url)

    print("\nAll tasks finished.")

if __name__ == "__main__":
    asyncio.run(main())
