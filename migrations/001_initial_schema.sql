-- Reference schema for tdms_pmfilter. Tables were created separately by the operator.
CREATE DATABASE IF NOT EXISTS tdms_pmfilter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tdms_pmfilter;

CREATE TABLE IF NOT EXISTS pm_list (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 title VARCHAR(255) NOT NULL,
 description TEXT NULL,
 status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
 created_by VARCHAR(255) NOT NULL,
 updated_by VARCHAR(255) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 cancelled_at DATETIME(3) NULL,
 PRIMARY KEY (id), KEY idx_pm_list_status (status), KEY idx_pm_list_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pm_devices (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 pm_id BIGINT UNSIGNED NOT NULL,
 device_name VARCHAR(255) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), UNIQUE KEY uq_pm_device (pm_id, device_name), KEY idx_device_name (device_name),
 CONSTRAINT fk_pm_devices_pm_list FOREIGN KEY (pm_id) REFERENCES pm_list(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pm_time_windows (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 pm_id BIGINT UNSIGNED NOT NULL,
 start_time DATETIME(3) NOT NULL,
 end_time DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), KEY idx_pm_window (pm_id, start_time, end_time),
 CONSTRAINT fk_pm_windows_pm_list FOREIGN KEY (pm_id) REFERENCES pm_list(id) ON DELETE CASCADE,
 CONSTRAINT chk_pm_window CHECK (end_time > start_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 pm_id BIGINT UNSIGNED NULL,
 actor_name VARCHAR(255) NOT NULL,
 actor_id VARCHAR(255) NOT NULL,
 action VARCHAR(50) NOT NULL,
 details JSON NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id), KEY idx_audit_pm_created (pm_id, created_at), KEY idx_audit_actor_id_created (actor_id, created_at),
 CONSTRAINT fk_audit_pm_list FOREIGN KEY (pm_id) REFERENCES pm_list(id) ON DELETE SET NULL
) ENGINE=InnoDB;
