-- M10(마무리): 리뷰 답글(ReviewReply) 신고 연동을 위해 신고 대상 타입에 'reply' 추가.
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'reply';
