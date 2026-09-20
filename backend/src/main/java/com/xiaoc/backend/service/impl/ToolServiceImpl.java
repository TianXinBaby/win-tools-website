package com.xiaoc.backend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xiaoc.backend.entity.Tool;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.mapper.ToolMapper;
import com.xiaoc.backend.service.ToolService;
import com.xiaoc.backend.vo.ToolVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ToolServiceImpl implements ToolService {

    private final ToolMapper toolMapper;

    @Override
    public List<ToolVO> listPublicTools() {
        return toolMapper.selectList(new LambdaQueryWrapper<Tool>()
                        .eq(Tool::getStatus, 1)
                        .orderByAsc(Tool::getSortOrder)
                        .orderByAsc(Tool::getId))
                .stream().map(this::toVO).toList();
    }

    @Override
    public ToolVO getPublicTool(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new ResourceNotFoundException("Tool resource not found");
        }
        Tool tool = toolMapper.selectOne(new LambdaQueryWrapper<Tool>()
                .eq(Tool::getSlug, slug)
                .eq(Tool::getStatus, 1));
        if (tool == null) {
            throw new ResourceNotFoundException("Tool resource not found");
        }
        return toVO(tool);
    }

    private ToolVO toVO(Tool tool) {
        return new ToolVO(tool.getId(), tool.getName(), tool.getSlug(), tool.getIcon(),
                tool.getDescription(), tool.getCategory(), tool.getPath());
    }
}
