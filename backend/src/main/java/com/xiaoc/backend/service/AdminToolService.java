package com.xiaoc.backend.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.xiaoc.backend.dto.AdminToolSaveRequest;
import com.xiaoc.backend.entity.Tool;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.exception.ResourceConflictException;
import com.xiaoc.backend.mapper.ToolMapper;
import com.xiaoc.backend.vo.AdminToolVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminToolService {

    private final ToolMapper mapper;

    public List<AdminToolVO> list() {
        return mapper.selectList(new LambdaQueryWrapper<Tool>()
                .orderByAsc(Tool::getSortOrder, Tool::getId))
                .stream().map(this::toVO).toList();
    }

    public AdminToolVO detail(long id) {
        return toVO(require(id));
    }

    @Transactional
    public AdminToolVO create(AdminToolSaveRequest request) {
        checkSlug(request.slug(), null);
        Tool entity = new Tool();
        entity.setName(request.name());
        entity.setSlug(request.slug());
        entity.setIcon(request.icon());
        entity.setDescription(request.description());
        entity.setCategory(request.category());
        entity.setPath(request.path());
        entity.setStatus(request.status());
        entity.setSortOrder(request.sortOrder());
        mapper.insert(entity);
        return detail(entity.getId());
    }

    @Transactional
    public AdminToolVO update(long id, AdminToolSaveRequest request) {
        require(id);
        checkSlug(request.slug(), id);
        // Explicit SET also clears nullable fields; timestamps and viewCount stay database-owned.
        mapper.update(null, new LambdaUpdateWrapper<Tool>()
                .eq(Tool::getId, id)
                .set(Tool::getName, request.name())
                .set(Tool::getSlug, request.slug())
                .set(Tool::getIcon, request.icon())
                .set(Tool::getDescription, request.description())
                .set(Tool::getCategory, request.category())
                .set(Tool::getPath, request.path())
                .set(Tool::getStatus, request.status())
                .set(Tool::getSortOrder, request.sortOrder()));
        return detail(id);
    }

    @Transactional
    public AdminToolVO updateStatus(long id, int status) {
        require(id);
        mapper.update(null, new LambdaUpdateWrapper<Tool>()
                .eq(Tool::getId, id).set(Tool::getStatus, status));
        return detail(id);
    }

    @Transactional
    public AdminToolVO updateSort(long id, int sortOrder) {
        require(id);
        mapper.update(null, new LambdaUpdateWrapper<Tool>()
                .eq(Tool::getId, id).set(Tool::getSortOrder, sortOrder));
        return detail(id);
    }

    @Transactional
    public void delete(long id) {
        if (mapper.deleteById(id) == 0) {
            throw new ResourceNotFoundException("Tool resource not found");
        }
    }

    private Tool require(long id) {
        Tool entity = mapper.selectById(id);
        if (entity == null) {
            throw new ResourceNotFoundException("Tool resource not found");
        }
        return entity;
    }

    private void checkSlug(String slug, Long ownId) {
        if (mapper.exists(new LambdaQueryWrapper<Tool>()
                .eq(Tool::getSlug, slug).ne(ownId != null, Tool::getId, ownId))) {
            throw new ResourceConflictException("Tool slug already exists");
        }
    }

    private AdminToolVO toVO(Tool entity) {
        return new AdminToolVO(
                entity.getId(),
                entity.getName(),
                entity.getSlug(),
                entity.getIcon(),
                entity.getDescription(),
                entity.getCategory(),
                entity.getPath(),
                entity.getStatus(),
                entity.getSortOrder(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
