package com.xiaoc.backend.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xiaoc.backend.entity.Article;
import com.xiaoc.backend.entity.Tool;
import com.xiaoc.backend.mapper.ArticleMapper;
import com.xiaoc.backend.mapper.ToolMapper;
import com.xiaoc.backend.vo.AdminDashboardStatsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final ToolMapper toolMapper;
    private final ArticleMapper articleMapper;

    public AdminDashboardStatsVO stats() {
        // Read only the fields needed for tool counts; article bodies are never loaded.
        List<Tool> tools = toolMapper.selectList(new LambdaQueryWrapper<Tool>()
                .select(Tool::getCategory, Tool::getStatus));
        long enabled = tools.stream().filter(tool -> Integer.valueOf(1).equals(tool.getStatus())).count();
        long disabled = tools.stream().filter(tool -> Integer.valueOf(0).equals(tool.getStatus())).count();
        long categories = tools.stream().map(Tool::getCategory)
                .filter(category -> category != null && !category.isBlank()).distinct().count();
        long articles = articleMapper.selectCount(null);
        long published = articleMapper.selectCount(new LambdaQueryWrapper<Article>()
                .eq(Article::getStatus, 1));
        return new AdminDashboardStatsVO(tools.size(), enabled, disabled, articles, published, categories);
    }
}
