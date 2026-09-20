-- Local development examples only. Run sql/init.sql first and select win_tools.
-- Run sequentially in a single local session; not a concurrent seed/migration job.
-- Existing matching rows (including disabled rows) are preserved, never updated.
-- Versions below are examples, not a claim about the current Microsoft download.
-- Unknown release dates/checksums stay NULL; the official page may offer another version.
-- Read the target directly in INSERT ... SELECT, not inside a target-table subquery.
-- Aggregate existence checks emit one row only when no matching row exists.

INSERT INTO windows_version
    (name, version, edition, architecture, release_date, description,
     official_download_url, sha256, image_url, status, sort_order)
SELECT 'Windows 11', '24H2', 'Windows 11', 'x64', NULL,
       '本地开发示例；实际可下载版本与系统要求请以 Microsoft 官方页面为准。',
       'https://www.microsoft.com/software-download/windows11', NULL, NULL, 1, 10
FROM windows_version
WHERE name = 'Windows 11' AND version = '24H2'
  AND edition = 'Windows 11' AND architecture = 'x64'
HAVING COUNT(*) = 0;

INSERT INTO windows_version
    (name, version, edition, architecture, release_date, description,
     official_download_url, sha256, image_url, status, sort_order)
SELECT 'Windows 10', '22H2', 'Windows 10', 'x64', NULL,
       '本地开发示例；实际可下载版本与支持状态请以 Microsoft 官方页面为准。',
       'https://www.microsoft.com/software-download/windows10', NULL, NULL, 1, 20
FROM windows_version
WHERE name = 'Windows 10' AND version = '22H2'
  AND edition = 'Windows 10' AND architecture = 'x64'
HAVING COUNT(*) = 0;
