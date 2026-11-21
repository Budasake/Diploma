"""enable pgvector extension

Revision ID: 2f3564b7739c
Revises:
Create Date: 2026-11-21 19:47:36.893950

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f3564b7739c"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Turn on pgvector so tables can store embeddings (vector columns)."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    """Turn pgvector off again."""
    op.execute("DROP EXTENSION IF EXISTS vector")
