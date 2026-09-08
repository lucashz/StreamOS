UPDATE "LiveQueueItem" SET status = 'QUEUED' WHERE status = 'APPROVED';
UPDATE "LiveQueueItem" SET status = 'COMPLETED' WHERE status = 'PLAYED';
