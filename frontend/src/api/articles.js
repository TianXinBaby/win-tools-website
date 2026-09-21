import request from '../utils/request'
export const getArticles = () => request.get('/articles')
export const getArticleDetail = (id) => request.get(`/articles/${encodeURIComponent(id)}`)
