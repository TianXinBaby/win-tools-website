package com.xiaoc.backend.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xiaoc.backend.entity.AdminUser;
import com.xiaoc.backend.entity.Article;
import com.xiaoc.backend.entity.Tool;
import com.xiaoc.backend.entity.WindowsVersion;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DatabaseMapperTests {

    @Autowired
    private WindowsVersionMapper windowsVersionMapper;
    @Autowired
    private ToolMapper toolMapper;
    @Autowired
    private ArticleMapper articleMapper;
    @Autowired
    private AdminUserMapper adminUserMapper;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private SqlSessionTemplate sqlSession;
    @Autowired
    private DataSource dataSource;
    @Autowired
    private MockMvc mockMvc;

    @Test
    void allMappersAreAvailableAgainstAnIsolatedEmptyH2Database() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("H2");
            assertThat(connection.getMetaData().getURL()).startsWith("jdbc:h2:mem:");
        }
        assertThat(windowsVersionMapper.selectCount(null)).isZero();
        assertThat(toolMapper.selectCount(null)).isZero();
        assertThat(articleMapper.selectCount(null)).isZero();
        assertThat(adminUserMapper.selectCount(null)).isZero();
    }

    @Test
    void windowsVersionSupportsCrudAndCamelCaseMappings() {
        WindowsVersion version = new WindowsVersion();
        version.setName("Windows mapping test");
        version.setVersion("test-version");
        version.setEdition("test-edition");
        version.setArchitecture("x64");
        version.setReleaseDate(LocalDate.of(2025, 1, 2));
        version.setDescription("仅用于字段映射测试 🪟");
        version.setOfficialDownloadUrl("https://www.microsoft.com/software-download/windows11");
        version.setSha256("a".repeat(64));
        version.setImageUrl("/images/test-windows.png");
        version.setStatus(1);
        version.setSortOrder(7);

        assertThat(windowsVersionMapper.insert(version)).isEqualTo(1);
        assertThat(version.getId()).isPositive();
        WindowsVersion loaded = windowsVersionMapper.selectById(version.getId());
        assertThat(loaded).usingRecursiveComparison()
                .ignoringFields("createdAt", "updatedAt").isEqualTo(version);
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getUpdatedAt()).isNotNull();
        assertThat(jdbc.queryForObject(
                "SELECT official_download_url FROM windows_version WHERE id = ?",
                String.class, version.getId())).isEqualTo(version.getOfficialDownloadUrl());

        loaded.setSortOrder(12);
        loaded.setStatus(0);
        assertThat(windowsVersionMapper.updateById(loaded)).isEqualTo(1);
        WindowsVersion updated = windowsVersionMapper.selectOne(new LambdaQueryWrapper<WindowsVersion>()
                .eq(WindowsVersion::getStatus, 0).eq(WindowsVersion::getSortOrder, 12));
        assertThat(updated.getId()).isEqualTo(version.getId());
        assertThat(windowsVersionMapper.deleteById(version.getId())).isEqualTo(1);
        assertThat(windowsVersionMapper.selectById(version.getId())).isNull();
    }

    @Test
    void toolMapsAllFieldsAndUsesDatabaseDefaults() {
        Tool tool = newTool("json-test");
        tool.setIcon("test-icon");
        tool.setDescription("本地工具目录测试");
        tool.setCategory("developer");
        assertThat(toolMapper.insert(tool)).isEqualTo(1);
        assertThat(tool.getId()).isPositive();
        Tool loaded = toolMapper.selectById(tool.getId());
        assertThat(loaded).usingRecursiveComparison()
                .ignoringFields("status", "sortOrder", "createdAt", "updatedAt").isEqualTo(tool);
        assertThat(loaded.getStatus()).isEqualTo(1);
        assertThat(loaded.getSortOrder()).isZero();
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getUpdatedAt()).isNotNull();
    }

    @Test
    void toolSlugMustBeUnique() {
        toolMapper.insert(newTool("duplicate-tool"));
        assertThatThrownBy(() -> toolMapper.insert(newTool("duplicate-tool")))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void articleMapsLongContentAndUnsignedViewCountRange() {
        Article article = newArticle("long-article");
        article.setSummary("测试摘要");
        article.setContent("长文章 🪟\n".repeat(15000));
        article.setCoverImage("/images/test-cover.png");
        article.setCategory("tutorial");
        assertThat(articleMapper.insert(article)).isEqualTo(1);
        assertThat(article.getId()).isPositive();
        Article loaded = articleMapper.selectById(article.getId());
        assertThat(loaded).usingRecursiveComparison()
                .ignoringFields("status", "viewCount", "createdAt", "updatedAt").isEqualTo(article);
        assertThat(loaded.getStatus()).isZero();
        assertThat(loaded.getViewCount()).isZero();
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getUpdatedAt()).isNotNull();
        loaded.setViewCount(4294967295L);
        assertThat(articleMapper.updateById(loaded)).isEqualTo(1);
        assertThat(articleMapper.selectById(article.getId()).getViewCount()).isEqualTo(4294967295L);
    }

    @Test
    void articleSlugMustBeUnique() {
        articleMapper.insert(newArticle("duplicate-article"));
        assertThatThrownBy(() -> articleMapper.insert(newArticle("duplicate-article")))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void articleViewCountRejectsValuesOutsideUnsignedIntRange() {
        Article article = newArticle("invalid-count");
        article.setViewCount(-1L);
        assertThatThrownBy(() -> articleMapper.insert(article))
                .isInstanceOf(DataIntegrityViolationException.class);
        article.setViewCount(4294967296L);
        assertThatThrownBy(() -> articleMapper.insert(article))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void adminUserMapsFieldsAndRequiresUniqueUsername() {
        AdminUser admin = new AdminUser();
        admin.setUsername("mapping-test-admin");
        // Non-login fixture exercising hash storage length, not a credential or seeded account.
        admin.setPassword("test-only-hash-storage:" + "x".repeat(200));
        admin.setNickname("测试管理员");
        assertThat(adminUserMapper.insert(admin)).isEqualTo(1);
        assertThat(admin.getId()).isPositive();
        AdminUser loaded = adminUserMapper.selectById(admin.getId());
        assertThat(loaded).usingRecursiveComparison()
                .ignoringFields("status", "createdAt", "updatedAt").isEqualTo(admin);
        assertThat(loaded.getStatus()).isEqualTo(1);
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getUpdatedAt()).isNotNull();
        admin.setId(null);
        assertThatThrownBy(() -> adminUserMapper.insert(admin)).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void databaseOwnsTimestampsEvenWhenUpdatingALoadedEntity() {
        Tool tool = newTool("timestamps");
        LocalDateTime oldTime = LocalDateTime.of(2000, 1, 1, 0, 0);
        tool.setCreatedAt(oldTime);
        tool.setUpdatedAt(oldTime);
        toolMapper.insert(tool);
        Tool inserted = toolMapper.selectById(tool.getId());
        assertThat(inserted.getCreatedAt()).isAfter(oldTime);
        assertThat(inserted.getUpdatedAt()).isAfter(oldTime);

        jdbc.update("UPDATE tool SET updated_at = ? WHERE id = ?", oldTime, tool.getId());
        // JDBC bypasses MyBatis, so discard its transaction-local query cache.
        sqlSession.clearCache();
        Tool loaded = toolMapper.selectById(tool.getId());
        assertThat(loaded.getUpdatedAt()).isEqualTo(oldTime);
        loaded.setName("Updated name");
        loaded.setCreatedAt(oldTime);
        assertThat(toolMapper.updateById(loaded)).isEqualTo(1);
        Tool updated = toolMapper.selectById(tool.getId());
        assertThat(updated.getCreatedAt()).isEqualTo(inserted.getCreatedAt());
        assertThat(updated.getUpdatedAt()).isAfter(oldTime);
    }

    @Test
    void helloRemainsAvailableWithTheFullDatabaseApplicationContext() throws Exception {
        mockMvc.perform(get("/api/hello"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"code":200,"message":"success","data":"Hello Win Tools!"}
                        """));
    }

    private Tool newTool(String slug) {
        Tool tool = new Tool();
        tool.setName("Test tool");
        tool.setSlug(slug);
        tool.setPath("/tools/" + slug);
        return tool;
    }

    private Article newArticle(String slug) {
        Article article = new Article();
        article.setTitle("Test article");
        article.setSlug(slug);
        return article;
    }
}
