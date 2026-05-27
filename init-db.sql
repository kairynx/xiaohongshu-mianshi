-- 面经助手数据库初始化脚本
-- 使用方法: mysql -u root -p < init-db.sql

CREATE DATABASE IF NOT EXISTS mianshi_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mianshi_app;

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(500) NOT NULL COMMENT '标题',
  author VARCHAR(200) DEFAULT '' COMMENT '作者',
  avatar VARCHAR(1000) DEFAULT '' COMMENT '头像URL',
  cover_url VARCHAR(1000) DEFAULT '' COMMENT '封面图URL',
  category VARCHAR(50) DEFAULT 'frontend' COMMENT '分类: frontend/backend/testdev/mobile/product',
  category_name VARCHAR(100) DEFAULT '前端开发' COMMENT '分类中文名',
  date VARCHAR(20) DEFAULT '' COMMENT '发布日期',
  source VARCHAR(200) DEFAULT '' COMMENT '来源',
  likes INT DEFAULT 0 COMMENT '点赞数',
  collects INT DEFAULT 0 COMMENT '收藏数',
  tags JSON DEFAULT NULL COMMENT '标签',
  content LONGTEXT COMMENT '内容(含OCR)',
  note_id VARCHAR(100) DEFAULT '' COMMENT '小红书帖子ID',
  xsec_token VARCHAR(500) DEFAULT '' COMMENT '小红书token',
  status VARCHAR(20) DEFAULT 'unread' COMMENT '状态: read/unread',
  priority VARCHAR(20) DEFAULT 'medium' COMMENT '优先级: high/medium/low',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_date (date),
  INDEX idx_note_id (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='面经帖子表';
