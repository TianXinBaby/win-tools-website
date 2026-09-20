package com.xiaoc.backend.mapper;

import com.xiaoc.backend.entity.WindowsVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WindowsDevSeedTests {

    @Autowired
    private DataSource dataSource;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private WindowsVersionMapper mapper;

    @Test
    void seedCanBeRepeatedAndOnlyContainsOfficialPagesWithUnknownChecksums() {
        seed();
        seed();
        var versions = mapper.selectList(null);
        assertThat(versions).hasSize(2);
        assertThat(versions).extracting(WindowsVersion::getOfficialDownloadUrl).containsExactlyInAnyOrder(
                "https://www.microsoft.com/software-download/windows11",
                "https://www.microsoft.com/software-download/windows10");
        assertThat(versions).allSatisfy(version -> {
            assertThat(version.getSha256()).isNull();
            assertThat(version.getReleaseDate()).isNull();
            assertThat(version.getStatus()).isEqualTo(1);
        });
    }

    @Test
    void seedDoesNotOverwriteOrReenableAnExistingRow() {
        seed();
        jdbc.update("""
                UPDATE windows_version SET status = 0, description = ?, sort_order = 42
                WHERE name = 'Windows 11'
                """, "User-maintained description");
        var before = jdbc.queryForList("SELECT * FROM windows_version ORDER BY id");
        seed();
        assertThat(jdbc.queryForList("SELECT * FROM windows_version ORDER BY id")).isEqualTo(before);
    }

    private void seed() {
        var populator = new ResourceDatabasePopulator(new FileSystemResource("../sql/seed-dev.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }
}
