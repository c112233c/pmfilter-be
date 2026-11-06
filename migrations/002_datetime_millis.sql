-- Ensure existing tdms_pmfilter tables retain millisecond precision.
-- DATETIME values are stored as UTC by the application; API instants are timezone-aware ISO 8601.
USE tdms_pmfilter;

ALTER TABLE pm_list
  MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  MODIFY cancelled_at DATETIME(3) NULL;

ALTER TABLE pm_devices
  MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE pm_time_windows
  MODIFY start_time DATETIME(3) NOT NULL,
  MODIFY end_time DATETIME(3) NOT NULL,
  MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE audit_logs
  MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
