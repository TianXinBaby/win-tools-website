package com.xiaoc.backend.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.xiaoc.backend.dto.AdminArticleSaveRequest;
import com.xiaoc.backend.entity.Article;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.exception.ResourceConflictException;
import com.xiaoc.backend.mapper.ArticleMapper;
import com.xiaoc.backend.vo.AdminArticleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminArticleService {

    private final ArticleMapper mapper;

    public List<AdminArticleVO> list() {
        return mapper.selectList(new LambdaQueryWrapper<Article>()
                .orderByDesc(Article::getCreatedAt, Article::getId))
                .stream().map(this::toVO).toList();
    }

    public AdminArticleVO detail(long id) {
        return toVO(require(id));
    }

    @Transactional
    public AdminArticleVO create(AdminArticleSaveRequest request) {
        checkSlug(request.slug(), null);
        Article entity = new Article();
        entity.setTitle(request.title());
        entity.setSlug(request.slug());
        entity.setSummary(request.summary());
        entity.setContent(request.content());
        entity.setCoverImage(request.coverImage());
        entity.setCategory(request.category());
        entity.setStatus(request.status());
        entity.setViewCount(0L);
        mapper.insert(entity);
        return detail(entity.getId());
    }

    @Transactional
    public AdminArticleVO update(long id, AdminArticleSaveRequest request) {
        require(id);
        checkSlug(request.slug(), id);
        // Explicit SET also clears nullable fields; timestamps and viewCount stay database-owned.
        mapper.update(null, new LambdaUpdateWrapper<Article>()
                .eq(Article::getId, id)
                .set(Article::getTitle, request.title())
                .set(Article::getSlug, request.slug())
                .set(Article::getSummary, request.summary())
                .set(Article::getContent, request.content())
                .set(Article::getCoverImage, request.coverImage())
                .set(Article::getCategory, request.category())
                .set(Article::getStatus, request.status()));
        return detail(id);
    }

    @Transactional
    public void delete(long id) {
        if (mapper.deleteById(id) == 0) {
            throw new ResourceNotFoundException("Article resource not found");
        }
    }

    private Article require(long id) {
        Article entity = mapper.selectById(id);
        if (entity == null) {
            throw new ResourceNotFoundException("Article resource not found");
        }
        return entity;
    }

    private void checkSlug(String slug, Long ownId) {
        if (mapper.exists(new LambdaQueryWrapper<Article>()
                .eq(Article::getSlug, slug).ne(ownId != null, Article::getId, ownId))) {
            throw new ResourceConflictException("Article slug already exists");
        }
    }

    private AdminArticleVO toVO(Article entity) {
        return new AdminArticleVO(
                entity.getId(),
                entity.getTitle(),
                entity.getSlug(),
                entity.getSummary(),
                entity.getContent(),
                entity.getCoverImage(),
                entity.getCategory(),
                entity.getStatus(),
                entity.getViewCount(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
