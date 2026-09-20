package com.xiaoc.backend.service;

import com.xiaoc.backend.vo.ToolVO;

import java.util.List;

public interface ToolService {

    List<ToolVO> listPublicTools();

    ToolVO getPublicTool(String slug);
}
