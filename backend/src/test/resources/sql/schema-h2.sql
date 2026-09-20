-- H2 test-only adaptation of sql/init.sql; keep columns/defaults/uniqueness in sync.
-- No MySQL database selection, engine/collation or listing indexes.
-- H2 has no unsigned types: view_count uses BIGINT with the MySQL INT UNSIGNED range.
-- LONGTEXT becomes CLOB; H2 cannot validate MySQL collation semantics.
-- Official Windows resource metadata; no ISO files or seed download records.
CREATE TABLE IF NOT EXISTS windows_version (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    edition VARCHAR(100),
    architecture VARCHAR(20),
    release_date DATE,
    description TEXT,
    official_download_url VARCHAR(1000),
    sha256 VARCHAR(64),
    image_url VARCHAR(1000),
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Tool catalog only; browser-local tool implementations are a later phase.
CREATE TABLE IF NOT EXISTS tool (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icon VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    path VARCHAR(255) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_tool_slug UNIQUE (slug)
);

-- Long-form articles; status 0 keeps drafts out of future published listings.
CREATE TABLE IF NOT EXISTS article (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    summary VARCHAR(1000),
    content CLOB,
    cover_image VARCHAR(1000),
    category VARCHAR(100),
    status TINYINT NOT NULL DEFAULT 0 COMMENT '1 = published, 0 = draft',
    view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count BETWEEN 0 AND 4294967295),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_article_slug UNIQUE (slug)
);

-- No seeded administrator accounts. Password stores a future secure hash only.
CREATE TABLE IF NOT EXISTS admin_user (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL COMMENT 'Secure password hash only; never plaintext',
    nickname VARCHAR(100),
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_admin_username UNIQUE (username)
);
