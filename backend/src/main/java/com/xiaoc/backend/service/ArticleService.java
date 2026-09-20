package com.xiaoc.backend.service;

import com.xiaoc.backend.vo.ArticleDetailVO;
import com.xiaoc.backend.vo.ArticleListVO;

import java.util.List;

public interface ArticleService {

    List<ArticleListVO> listPublicArticles();

    ArticleDetailVO getPublicArticle(long id);
}
