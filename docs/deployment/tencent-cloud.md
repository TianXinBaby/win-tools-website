# 腾讯云 Linux 部署准备（阶段 10）

本文是人工执行的部署手册和示例，未执行真实腾讯云部署。所有域名、IP、密码、证书路径均为占位符。
阶段 11 须明确授权后再操作服务器、DNS、证书或生产数据库。

## 架构与前置条件

```text
Internet → HTTPS :443 → Nginx
                       ├── /var/www/win-tools（Vue dist）
                       └── /api → 127.0.0.1:8080（Java 18 / Spring Boot Jar）
                                  └── MySQL 8（本机回环或受限内网）
```

- 选择带 systemd 的腾讯云 Linux 实例，确认 CPU 架构、发行版、存储和备份位置。安装命令必须与实际发行版对应。
- 腾讯云安全组及主机防火墙只允许公网 80、443；22 仅允许管理 IP，优先 SSH key 登录。
  不向公网开放 8080、3306，也不使用 root 密码 SSH 作为推荐登录方式。
- 使用独立运维用户和 sudo，Java 使用 `win-tools` 系统用户；部署包由运维用户上传。
- 当前没有验证码、MFA、登录失败限流或账户锁定。BCrypt 和统一错误信息不能阻止暴力尝试。
  上线前应按实际管理网络限制 Nginx `/api/admin/` 的允许来源，或单独评审登录限流；
  当前示例未实现限流，不应据此认定已有防暴力保护。
- 不增加 Docker、Redis、JWT、外置 Tomcat 或 Node 后端。

## 安装 Java 18、MySQL 8 和 Nginx

1. Java 固定 18，不能用 `default-jdk` 意外安装其他版本。根据架构从
   [Java 18 官方归档](https://www.oracle.com/java/technologies/javase/jdk18-archive-downloads.html)
   下载对应 Linux 安装包，核对官方校验值，按
   [JDK 18 Linux 安装指南](https://docs.oracle.com/en/java/javase/18/install/installation-jdk-linux-platforms.html)
   使用 RPM/DEB 或解压包安装。Java 18 是旧的非 LTS 版本，上线前须评估维护支持；本阶段不替换 JDK。
   在服务器验证 `/usr/bin/java -version` 必须为 18。如果安装包只提供独立目录，
   将 service 示例的 ExecStart 改为该 Java 18 的绝对路径，无需修改整台服务器默认 Java。
2. MySQL 必须是 8。选择发行版的 MySQL 8 包或
   [MySQL 官方安装仓库](https://dev.mysql.com/doc/refman/8.0/en/linux-installation.html)，核对版本，不能用 MariaDB 代替。
   例如 Ubuntu 22.04 可先 `apt-cache policy mysql-server nginx` 检查候选版本，
   确认为 MySQL 8 后 `sudo apt update`、`sudo apt install mysql-server nginx`。
   腾讯云其他镜像应使用其对应 RPM/YUM 指引，不直接照搬 apt 命令。
3. 启动并检查 `mysql --version`、`nginx -v`、`systemctl status mysql`（RPM 系可能叫 `mysqld`）。
   完成 MySQL 安全初始化，移除匿名账号，禁用远程 root；MySQL 配置 `bind-address=127.0.0.1`。
   内网数据库应只允许应用主机访问，并另行设置经过验证的数据库 TLS，不直接沿用本机连接假设。
4. Nginx 需支持 TLS 1.2/1.3。核对 `nginx -V`，配置 MIME types（发行版默认 nginx.conf 通常已有
   `include /etc/nginx/mime.types;`），确保 `.js`、`.css` 类型正确。

## 本地验证与构建

在 Windows 项目目录下依次执行，所有命令成功后才能发布：

```powershell
cd frontend
npm.cmd ci --cache D:\study\win-tools-website\.cache\npm
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test
npm.cmd run build
npm.cmd audit --cache D:\study\win-tools-website\.cache\npm
cd ../backend
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp verify
.\mvnw.cmd -B -ntp dependency:tree
.\mvnw.cmd -B -ntp clean package
```

不跳过测试。上传 `backend/target/backend-0.0.1-SNAPSHOT.jar`、`frontend/dist/` 的内容、
`sql/init.sql` 和 `deploy/` 示例到运维用户的暂存目录，例如 `/tmp/win-tools-release`。
使用 `scp`/SFTP 向 `<DEPLOY_USER>@<SERVER_IP>` 上传；对上传前后的 Jar 做 SHA-256 校验。
仅 dist 进入 Web root，源码、env、SQL、Jar、test fixture、node_modules 均不能放进 Web root。
前端继续请求同源 `/api`，生产不运行 `npm run dev`，后端不运行 `mvn spring-boot:run`。
Vite 默认关闭生产 source map，保持该默认值。

## 用户、目录与权限

以下命令仅作为首次部署示例，已有用户/目录时先检查，不能覆盖已有配置：

```sh
sudo useradd --system --user-group --home /opt/win-tools --shell /usr/sbin/nologin win-tools
sudo install -d -o root -g win-tools -m 0750 /opt/win-tools/backend
sudo install -d -o win-tools -g win-tools -m 0700 /etc/win-tools
sudo install -d -o root -g root -m 0755 /var/www/win-tools
sudo install -o root -g win-tools -m 0640 /tmp/win-tools-release/backend-0.0.1-SNAPSHOT.jar /opt/win-tools/backend/backend.jar
sudo cp -a /tmp/win-tools-release/dist/. /var/www/win-tools/
sudo chown -R root:root /var/www/win-tools
sudo find /var/www/win-tools -type d -exec chmod 0755 {} \;
sudo find /var/www/win-tools -type f -exec chmod 0644 {} \;
```

Nginx worker（常见为 www-data 或 nginx）只能读取静态文件；Java 可以读取 Jar，不能自行替换 Jar。
禁止 `chmod 777`。SELinux 启用的发行版应按其策略设置 Web root 标签、允许 Nginx 连接本机上游，
不要通过关闭 SELinux 绕过访问失败。应用 stdout/stderr 进入 journal，无须额外建应用日志目录。

## 数据库 schema 和最小权限

先由数据库管理员备份已有库，再审核并显式运行 `sql/init.sql`。脚本创建 `win_tools` 和四张表，
字符集 utf8mb4；`IF NOT EXISTS` 不等同于迁移已有表。不要在应用启动时执行 SQL 初始化：prod 保持 `never`。

```sh
mysql -u root -p < /tmp/win-tools-release/sql/init.sql
```

`-p` 后不写密码。使用安全交互会话（可用 `MYSQL_HISTFILE=/dev/null mysql -u root -p` 避免客户端历史），
管理员手工替换 `<STRONG_PASSWORD>` 并执行：

```sql
CREATE USER 'win_tools_app'@'localhost' IDENTIFIED BY '<STRONG_PASSWORD>';
GRANT SELECT, INSERT, UPDATE, DELETE ON win_tools.* TO 'win_tools_app'@'localhost';
SHOW GRANTS FOR 'win_tools_app'@'localhost';
```

不授予 DROP、CREATE、CREATE USER、GRANT OPTION、SUPER。CREATE USER/GRANT 立即生效，无须额外 FLUSH PRIVILEGES。
生产示例通过回环 TCP 连接，应使用 `mysql --protocol=TCP -h 127.0.0.1 -u win_tools_app -p win_tools`
验证账号匹配和权限；若服务配置要求 `@127.0.0.1`，建立对应精确 host 账号，不用 `%` 放宽来源。
`DB_NAME` 默认必须与 init.sql 的 `win_tools` 一致；自定义库名需要管理员同步审核脚本及授权。

`sql/seed-dev.sql` 仅为开发/测试演示数据，生产步骤默认不导入。开发环境顺序为 init.sql → seed-dev.sql；
生产确需初始内容时必须人工审核后显式执行。两者都不创建默认管理员。

## 显式初始化管理员

没有匿名 HTTP 创建管理员或生成 Hash 的接口。运维人员必须在可信本地环境生成 BCrypt strength 12 Hash。
项目提供 **test scope** 离线辅助类，既不启动 Spring，也不会进入正式 Jar。先在 `backend` 执行：

```powershell
.\mvnw.cmd -B -ntp test-compile dependency:build-classpath '-Dmdep.outputFile=target/admin-hash-classpath.txt'
$hashClasspath = 'target/test-classes;' + (Get-Content target/admin-hash-classpath.txt -Raw).Trim()
& "$env:JAVA_HOME\bin\java.exe" -cp $hashClasspath com.xiaoc.backend.support.AdminPasswordHash
```

必须在交互终端运行，隐藏输入两次密码；不接受命令行密码，也不从环境变量读取密码。
选择足够长、唯一的密码，总长度不能超过 72 个 UTF-8 字节；Hash 也不要公开或提交。
辅助程序退出后清理剪贴板及终端输出，避免录屏/共享终端。管理员手工执行以下 SQL，占位符不能原样导入：

```sql
INSERT INTO win_tools.admin_user (username, password, nickname, status)
VALUES ('admin-name', '<BCRYPT_HASH>', 'Administrator', 1);
```

created_at / updated_at 由表默认值填写。不存在账号、禁用账号、错误密码保持相同 401 响应。

## EnvironmentFile 与 production profile

```sh
sudo install -o win-tools -g win-tools -m 0600 /tmp/win-tools-release/deploy/env/win-tools.env.example /etc/win-tools/win-tools.env
sudoedit /etc/win-tools/win-tools.env
```

用真实值替换密码占位符，不能将真实文件放回 Git。配置必须含 `SPRING_PROFILES_ACTIVE=prod`、
`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USERNAME`、`DB_PASSWORD`、`SESSION_COOKIE_SECURE=true`。
`SERVER_PORT` 默认 8080；修改它必须同步修改 Nginx 上游。

这是 systemd EnvironmentFile，不使用 `export` 或 shell 命令替换；特殊字符按 systemd 的引号规则填写，
不能用 shell `source` 加载。权限 600、owner win-tools，Nginx 用户和其他系统用户不得读取。
不要在 journal、命令行或诊断报告中输出完整环境变量。

prod 的 Session 为 30m、HttpOnly、SameSite=Lax、Secure；生产禁止设置 `SESSION_COOKIE_SECURE=false`。
本地默认 profile 仍允许 HTTP Cookie。Session ID 不进入 API JSON，CSRF token 只用于已有 CSRF 接口及内存请求头。
登录轮换 Session ID 和 CSRF token，退出使 Session 失效；重启会丢失 JVM Session，管理员需重新登录。

prod 使用 INFO 日志、禁用 MyBatis SQL 日志和请求详情；未处理异常仅记录异常类型，
不记录异常消息、堆栈、密码、正文、Token 或 Session ID。4xx/5xx 返回统一安全 JSON，容器 `/error` 同样过滤内部信息。
启动故障的底层库日志仍仅对运维人员开放，分享日志前需人工脱敏。

## systemd

```sh
sudo install -o root -g root -m 0644 /tmp/win-tools-release/deploy/systemd/win-tools-backend.service.example /etc/systemd/system/win-tools-backend.service
sudo systemd-analyze verify /etc/systemd/system/win-tools-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now win-tools-backend
sudo systemctl status win-tools-backend --no-pager
curl --fail http://127.0.0.1:8080/api/health
```

确认 `/usr/bin/java` 为 Java 18 后再启动。service 使用 User/Group=win-tools，
WorkingDirectory=/opt/win-tools/backend，EnvironmentFile=/etc/win-tools/win-tools.env，
ExecStart 为 `java -jar`，Restart=on-failure，NoNewPrivileges、PrivateTmp、UMask=0077。
未设置破坏数据库网络访问的 sandbox。MySQL 不可用时排查连接，health 是存活检查，不代表数据库就绪。

## 域名、HTTPS 与 Nginx

人工确认域名及 DNS；中国大陆服务器按实际业务和腾讯云要求确认备案后再开放站点。
选择腾讯云 SSL 或 Let's Encrypt 提供证书，将完整链和私钥安装到实际路径，私钥 root 持有、600。
配置示例路径是 `/etc/nginx/ssl/example.com/fullchain.pem` 和 `privkey.pem`，不得提交真实证书/私钥。
Let's Encrypt 可使用 DNS 验证维持 80 端口仅重定向；如选 HTTP 验证需另行审核 challenge 路径配置及续期流程。
制定到期检查、续期和 Nginx reload 流程；本阶段不自动申请证书。

```sh
sudo install -o root -g root -m 0644 /tmp/win-tools-release/deploy/nginx/win-tools.conf.example /etc/nginx/conf.d/win-tools.conf
sudoedit /etc/nginx/conf.d/win-tools.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

替换所有 example.com 和证书路径，确认 conf.d 在 nginx.conf 的 **http {}** 中包含，检查默认站点和域名冲突。
Nginx 配置采用 TLS 1.2/1.3；80 只 301 跳转到固定 HTTPS 域名，后台不得长期用 HTTP 登录。
`/api` 和 `/api/` 原路径转发至回环 8080，不能末尾添加斜线导致去掉 `/api`。
`try_files $uri $uri/ /index.html` 支持 SPA 深链接，缺失 assets 返回 404，index.html 不长期缓存。
`client_max_body_size 1m` 容纳现有文章正文 JSON；本地图片处理不上传。

### 响应头、转发信任与 CSP

生产最终策略由 Nginx 统一输出，`always` 覆盖错误响应，并隐藏上游同名头避免重复。
后端保留 Spring Security 默认保护、DENY 和 Referrer-Policy，CSP 仅在 Nginx 设置。
不要在 location 新增 add_header 导致丢失 server 级继承策略。

- X-Content-Type-Options=nosniff，X-Frame-Options=DENY，Referrer-Policy=strict-origin-when-cross-origin。
- 禁用 camera、geolocation；仅允许本站在用户点击声控弹力球的启动按钮后请求 microphone。HTTPS 下验证麦克风、Clipboard 和 Web Crypto。
- script-src 只允许 self，无 unsafe-eval / inline script；Vue 使用 Vite 预编译产物，无 CDN。
  Element Plus 动态样式需要 style-src 的 unsafe-inline。
  img-src 支持 self、data、blob 和 HTTPS（封面/本地预览/二维码）；远程 HTTP 图片在 HTTPS 生产站点不受支持，应改用 HTTPS。
  connect-src 仅 self，object-src none、base-uri self、frame-ancestors none、form-action self。
- CSP 已提供本地 Chrome 生产构建验证入口，覆盖后台 CRUD、Element Plus 弹窗、二维码、图片解码及导出。
  这不能替代真实 Nginx/TLS 的部署后验收。
- 可在 HTTPS、证书续期确认正常后取消 HSTS 注释，先 max-age=86400；不加 includeSubDomains/preload。
  HSTS 期间浏览器会强制 HTTPS，错误配置不能靠 HTTP 回退修复。
- Spring Boot 设置 forward-headers-strategy=framework，只绑定 127.0.0.1。
  Nginx 重写 Host/X-Real-IP/X-Forwarded-*，清除 Forwarded、X-Forwarded-Prefix，避免客户端伪造转发链。
  当前单层公网 Nginx 使用 `$remote_addr` 覆盖 X-Forwarded-For；未来加 CDN/LB 必须重新设计可信代理范围。
- 前后端同源，不增加宽松 CORS。Nginx 不启用 API proxy cache，保留认证响应的 no-store。

配置依据：[Spring Boot 3.5 反向代理](https://docs.spring.io/spring-boot/3.5/how-to/webserver.html)、
[Nginx 响应头及继承规则](https://nginx.org/en/docs/http/ngx_http_headers_module.html)。

## 启动后的验收

```sh
sudo ss -lntp
curl -I http://example.com/admin/login
curl --fail https://example.com/api/health
curl -I https://example.com/admin/windows
curl -i https://example.com/api/admin/auth/me
sudo journalctl -u win-tools-backend -n 100 --no-pager
```

health 精确返回 `{"code":200,"message":"success","data":{"status":"UP"}}`，公开且不查数据库。
从受控外网核对 8080/3306 不可达；本机 8080 只监听 127.0.0.1，MySQL 只监听回环或授权内网。
检查 HTTP 301、有效证书链、响应头只有一份；health 成功后仍必须访问公开数据 API 验证真实 MySQL。
用浏览器验收刷新深链接、登录/退出、Session Cookie 属性、管理 CRUD、无 CSRF 返回 403、匿名 401、
二维码/图片预览导出、剪贴板及 SHA-256，Console 无 CSP violation。不要把 Cookie 值或 token 放进截图/日志。
Nginx access_log 关闭；error log 为 error，运维日志限制读取、保留和轮转，禁止配置 body/cookie/Authorization 日志字段。

## 备份、更新与回滚

Phase 11.14.2 起，应用 Jar 与前端静态文件的**更新**优先使用 [手工部署脚本](../../deploy/README.md)。以下步骤保留为首次安装和故障人工处理参考；脚本要求服务器上有完整项目检出，并不会备份或回滚数据库。

发布前备份数据库和两个应用产物。数据库备份账号独立于应用账号；为当前四张表授予 SELECT，
未来有视图/触发器时按需加 SHOW VIEW/TRIGGER，不能为方便给应用账号提升权限。
参考 [mysqldump 官方权限说明](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)。

```sh
umask 077
mysqldump -u win_tools_backup -p --single-transaction --no-tablespaces --set-gtid-purged=OFF win_tools > win_tools-backup.sql
```

使用交互密码或权限 600 的 `--defaults-extra-file`（作为第一个选项），禁止 `-pPASSWORD`。
在受限备份目录执行，检查退出码、文件非空，定期在隔离库验证恢复；加密异地备份并制定保留策略。
备份期间禁止并发 DDL。GTID/复制环境需 DBA 另行评审恢复流程。

1. 本地重新完成前后端测试与构建，上传到新的暂存目录，校验 Jar SHA-256。
2. 备份数据库；保留 `/opt/win-tools/backend/backend.jar.previous` 和上一版 dist 的受限归档。
   给备份加时间戳，避免覆盖唯一可用版本；备份不能放在 Web root 下。
3. 维护窗口内停止 backend，安装新的 backend.jar；在 Web root 外准备完整新 dist，检查后整体替换，
   避免旧的 hashed JS 残留或上传一半即公开。不要把开发服务器当成发布方案。
4. `sudo systemctl restart win-tools-backend`；若改 Nginx，先 `nginx -t` 再 reload。
5. 验证 health、公开 DB API、登录和管理操作、SPA 刷新、浏览器资源加载；观察 journal。
6. 失败时停止 backend，恢复 previous Jar 与配套 dist，确认权限后重新启动并重复验收。
   env/config 也应保留受限备份。Session 重启后需重新登录。
7. 本项目没有 schema migration 系统。涉及表结构时须独立审核兼容性；不能自动 destructive rollback 数据库。
   需要恢复数据库时先停止写入、保留故障现场，由管理员审核恢复方案，避免覆盖新数据。

## 当前验证边界

本地自动测试使用隔离 H2；未提供真实 MySQL 凭据时不尝试猜测，也不以 H2 通过声称 MySQL 已验证。
Windows 中检查部署配置和生产构建，真实 Linux 的 `nginx -t`、`systemd-analyze verify`、防火墙、TLS、
证书续期和真实数据库联调须在阶段 11 的授权服务器上完成。
