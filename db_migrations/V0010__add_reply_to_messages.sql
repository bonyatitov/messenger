ALTER TABLE t_p3482084_react_native_family_.messages
ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES t_p3482084_react_native_family_.messages(id);