-- MySQL 8 database foundation. Run manually with the MySQL client.
-- Re-running preserves existing tables/data; this is not a schema migration.
CREATE DATABASE IF NOT EXISTS win_tools
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

USE win_tools;

-- Official Windows resource metadata; no ISO files or seed download records.
CREATE TABLE IF NOT EXISTS windows_version (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
    PRIMARY KEY (id),
    KEY idx_windows_status_sort (status, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tool catalog only; browser-local tool implementations are a later phase.
CREATE TABLE IF NOT EXISTS tool (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
    UNIQUE KEY uk_tool_slug (slug),
    KEY idx_tool_status_sort (status, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Long-form articles; status 0 keeps drafts out of future published listings.
CREATE TABLE IF NOT EXISTS article (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    summary VARCHAR(1000),
    content LONGTEXT,
    cover_image VARCHAR(1000),
    category VARCHAR(100),
    status TINYINT NOT NULL DEFAULT 0 COMMENT '1 = published, 0 = draft',
    view_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_article_slug (slug),
    KEY idx_article_status_created (status, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- No seeded administrator accounts. Password stores a future secure hash only.
CREATE TABLE IF NOT EXISTS admin_user (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL COMMENT 'Secure password hash only; never plaintext',
    nickname VARCHAR(100),
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
