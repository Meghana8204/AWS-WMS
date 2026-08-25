import asyncio
import os
import sys


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database.session import session_scope

async def migrate():
    """
    Migrates supplier ID columns from UUID to VARCHAR.
    """
    tables_and_columns = [
        ("supplier", "id"),
        ("rfq_supplier_link", "supplier_id"),
        ("supplier_address", "supplier_id"),
        ("supplier_contact", "supplier_id"),
        ("supplier_bank_info", "supplier_id"),
        ("supplier_document", "supplier_id"),
        ("rfq", "selected_supplier_id"),
        ("quotation", "supplier_id"),
        ("asn", "supplier_id"),
        ("purchase_order", "supplier_id"),
        ("supplier_user", "supplier_id"),
        ("supplier_material_link", "supplier_id"),
    ]

    async with session_scope() as session:
        print("Starting migration of Supplier ID columns to VARCHAR...")



        for table, col in tables_and_columns:
            query = text(f"""
                SELECT constraint_name
                FROM information_schema.key_column_usage
                WHERE table_name = '{table}' AND column_name = '{col}'
                AND constraint_name NOT LIKE 'pk_%'
            """)
            res = await session.execute(query)
            constraints = res.fetchall()
            for c in constraints:
                print(f"Dropping constraint {c[0]} on {table}")
                await session.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {c[0]}"))


        for table, col in tables_and_columns:
            print(f"Altering {table}.{col} to VARCHAR(64)")

            await session.execute(text(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE VARCHAR(64) USING {col}::text"))


        print("Re-adding basic foreign key constraints...")



        fks = [
            ("rfq_supplier_link", "supplier_id", "supplier", "id"),
            ("supplier_address", "supplier_id", "supplier", "id"),
            ("supplier_contact", "supplier_id", "supplier", "id"),
            ("supplier_bank_info", "supplier_id", "supplier", "id"),
            ("supplier_document", "supplier_id", "supplier", "id"),
            ("quotation", "supplier_id", "supplier", "id"),
            ("asn", "supplier_id", "supplier", "id"),
            ("purchase_order", "supplier_id", "supplier", "id"),
            ("supplier_user", "supplier_id", "supplier", "id"),
            ("supplier_material_link", "supplier_id", "supplier", "id"),
        ]

        for table, col, ref_table, ref_col in fks:
            constraint_name = f"fk_{table}_{col}_{ref_table}"
            print(f"Adding constraint {constraint_name}")
            await session.execute(text(f"""
                ALTER TABLE {table}
                ADD CONSTRAINT {constraint_name}
                FOREIGN KEY ({col}) REFERENCES {ref_table}({ref_col})
                ON DELETE CASCADE
            """))

        await session.commit()
        print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
