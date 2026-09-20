package com.xiaoc.backend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xiaoc.backend.entity.Article;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.mapper.ArticleMapper;
import com.xiaoc.backend.service.ArticleService;
import com.xiaoc.backend.vo.ArticleDetailVO;
import com.xiaoc.backend.vo.ArticleListVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ArticleServiceImpl implements ArticleService {

    private final ArticleMapper articleMapper;

    @Override
    public List<ArticleListVO> listPublicArticles() {
        return articleMapper.selectList(new LambdaQueryWrapper<Article>()
                        .select(Article::getId, Article::getTitle, Article::getSlug, Article::getSummary,
                                Article::getCoverImage, Article::getCategory, Article::getViewCount,
                                Article::getCreatedAt)
                        .eq(Article::getStatus, 1)
                        .orderByDesc(Article::getCreatedAt)
                        .orderByDesc(Article::getId))
                .stream().map(this::toListVO).toList();
    }

    @Override
    public ArticleDetailVO getPublicArticle(long id) {
        if (id <= 0) {
            throw new ResourceNotFoundException("Article resource not found");
        }
        Article article = articleMapper.selectOne(new LambdaQueryWrapper<Article>()
                .eq(Article::getId, id)
                .eq(Article::getStatus, 1));
        if (article == null) {
            throw new ResourceNotFoundException("Article resource not found");
        }
        return new ArticleDetailVO(article.getId(), article.getTitle(), article.getSlug(), article.getSummary(),
                article.getContent(), article.getCoverImage(), article.getCategory(), article.getViewCount(),
                article.getCreatedAt(), article.getUpdatedAt());
    }

    private ArticleListVO toListVO(Article article) {
        return new ArticleListVO(article.getId(), article.getTitle(), article.getSlug(), article.getSummary(),
                article.getCoverImage(), article.getCategory(), article.getViewCount(), article.getCreatedAt());
    }
}
