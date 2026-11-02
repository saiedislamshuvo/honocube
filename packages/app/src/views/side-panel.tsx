import React, { useState, useRef } from "react";
import {
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  Upload,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  ArrowRight,
  X,
} from "lucide-react";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  cn,
} from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { formatFileSize } from "../utils/format.js";
import type {
  SidePanelProps,
  AuditActivity,
  DocumentComment,
  DocumentAttachment,
} from "./types.js";

/**
 * Collaboration and audit side panel for records, featuring field-level activity diffs,
 * real-time comments with user mentions, and file attachment management.
 */
export function SidePanel<TCollection extends Collection<any> = Collection<any>>({
  collection: _collection,
  recordId: _recordId,
  activities: controlledActivities,
  comments: controlledComments,
  attachments: controlledAttachments,
  onAddComment,
  onUploadAttachment,
  onDeleteAttachment,
  currentUser = { name: "Current User" },
  defaultTab = "activity",
  tabs = ["activity", "comments", "attachments"],
  isOpen = true,
  onClose,
  className = "",
}: SidePanelProps<TCollection>): React.JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  // Active Tab state
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Comments state (supports controlled or local fallback)
  const [localComments, setLocalComments] = useState<DocumentComment[]>(
    controlledComments || []
  );
  const comments = controlledComments ?? localComments;
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Attachments state (supports controlled or local fallback)
  const [localAttachments, setLocalAttachments] = useState<DocumentAttachment[]>(
    controlledAttachments || []
  );
  const attachments = controlledAttachments ?? localAttachments;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Activities state
  const activities: AuditActivity[] = controlledActivities || [];

  // 1. Submit Comment Handler
  const handleCommentSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      if (onAddComment) {
        await onAddComment(trimmed);
      }
      // Update local state if uncontrolled
      if (!controlledComments) {
        const newComment: DocumentComment = {
          id: `comment-${Date.now()}`,
          author: {
            name: currentUser.name,
            avatar: currentUser.avatar,
          },
          content: trimmed,
          createdAt: new Date(),
        };
        setLocalComments((prev) => [newComment, ...prev]);
      }
      setCommentText("");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 2. Upload Attachment Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (onUploadAttachment) {
        await onUploadAttachment(file);
      }
      if (!controlledAttachments) {
        const newAttachment: DocumentAttachment = {
          id: `att-${Date.now()}`,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date(),
          url: URL.createObjectURL(file),
        };
        setLocalAttachments((prev) => [newAttachment, ...prev]);
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 3. Delete Attachment Handler
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (onDeleteAttachment) {
      await onDeleteAttachment(attachmentId);
    }
    if (!controlledAttachments) {
      setLocalAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    }
  };

  // Helper for mentions
  const renderCommentContent = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9._-]+)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={index}
            data-testid="user-mention"
            className="font-medium text-primary bg-primary/10 rounded px-1 py-0.5"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Helper for file type icon
  const getFileIcon = (mimeType?: string, name?: string) => {
    if (mimeType?.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name || "")) {
      return <FileImage className="h-4 w-4 text-blue-500" />;
    }
    if (mimeType?.includes("sheet") || /\.(xlsx?|csv)$/i.test(name || "")) {
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <aside
      data-testid="side-panel"
      className={cn(
        "flex flex-col h-full w-full max-w-sm sm:max-w-md border-l border-border bg-background shadow-sm",
        className
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Collaboration & History
        </h2>
        {onClose && (
          <Button
            data-testid="side-panel-close"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <TabsList className="grid w-full grid-cols-3 h-8">
            {tabs.includes("activity") && (
              <TabsTrigger
                data-testid="tab-trigger-activity"
                value="activity"
                className="gap-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Activity</span>
              </TabsTrigger>
            )}
            {tabs.includes("comments") && (
              <TabsTrigger
                data-testid="tab-trigger-comments"
                value="comments"
                className="gap-1.5 text-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Comments</span>
              </TabsTrigger>
            )}
            {tabs.includes("attachments") && (
              <TabsTrigger
                data-testid="tab-trigger-attachments"
                value="attachments"
                className="gap-1.5 text-xs"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>Files</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* 1. Activity Tab Content */}
        {tabs.includes("activity") && (
          <TabsContent
            data-testid="tab-content-activity"
            value="activity"
            className="flex-1 overflow-y-auto p-4 space-y-4 m-0"
          >
            {activities.length === 0 ? (
              <div
                data-testid="activity-empty-state"
                className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2"
              >
                <Clock className="h-8 w-8 stroke-1 text-muted-foreground/60" />
                <p className="text-xs">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const initial =
                    activity.actor.name.charAt(0).toUpperCase() || "U";
                  const dateStr =
                    activity.timestamp instanceof Date
                      ? activity.timestamp.toLocaleString()
                      : String(activity.timestamp);

                  return (
                    <div
                      key={activity.id}
                      data-testid={`activity-item-${activity.id}`}
                      className="flex items-start gap-3 text-xs"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground text-xs">
                        {initial}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {activity.actor.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{activity.action}</p>

                        {/* Field Diffs */}
                        {activity.diffs && activity.diffs.length > 0 && (
                          <div className="mt-2 space-y-1.5 rounded border border-border/60 bg-muted/30 p-2">
                            {activity.diffs.map((diff, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center gap-1.5 text-[11px]"
                              >
                                <span className="font-medium text-foreground">
                                  {`${diff.field}:`}
                                </span>
                                <span className="line-through text-destructive/80">
                                  {String(diff.from ?? "empty")}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  {String(diff.to ?? "empty")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* 2. Comments Tab Content */}
        {tabs.includes("comments") && (
          <TabsContent
            data-testid="tab-content-comments"
            value="comments"
            className="flex flex-col flex-1 overflow-hidden m-0"
          >
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div
                  data-testid="comments-empty-state"
                  className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2"
                >
                  <MessageSquare className="h-8 w-8 stroke-1 text-muted-foreground/60" />
                  <p className="text-xs">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                comments.map((cmt) => {
                  const initial =
                    cmt.author.name.charAt(0).toUpperCase() || "U";
                  const dateStr =
                    cmt.createdAt instanceof Date
                      ? cmt.createdAt.toLocaleString()
                      : String(cmt.createdAt);

                  return (
                    <div
                      key={cmt.id}
                      data-testid={`comment-item-${cmt.id}`}
                      className="flex items-start gap-3 text-xs"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                        {initial}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {cmt.author.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {dateStr}
                          </span>
                        </div>
                        <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                          {renderCommentContent(cmt.content)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Input Box */}
            <form
              onSubmit={handleCommentSubmit}
              className="border-t border-border p-3 space-y-2 bg-muted/20"
            >
              <Textarea
                data-testid="comment-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment... Use @ to mention"
                rows={2}
                className="text-xs resize-none min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">
                  Press ⌘+Enter to submit
                </span>
                <Button
                  data-testid="comment-submit-button"
                  type="submit"
                  size="sm"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="h-7 px-3 text-xs gap-1"
                >
                  <Send className="h-3 w-3" />
                  <span>Send</span>
                </Button>
              </div>
            </form>
          </TabsContent>
        )}

        {/* 3. Attachments Tab Content */}
        {tabs.includes("attachments") && (
          <TabsContent
            data-testid="tab-content-attachments"
            value="attachments"
            className="flex flex-col flex-1 overflow-hidden m-0 p-4 space-y-4"
          >
            {/* Upload Area */}
            <div>
              <input
                data-testid="file-upload-input"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                data-testid="upload-attachment-trigger"
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed h-9 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Upload New File</span>
              </Button>
            </div>

            {/* Attachments List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {attachments.length === 0 ? (
                <div
                  data-testid="attachments-empty-state"
                  className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2"
                >
                  <Paperclip className="h-8 w-8 stroke-1 text-muted-foreground/60" />
                  <p className="text-xs">No attachments yet.</p>
                </div>
              ) : (
                attachments.map((att) => {
                  const dateStr =
                    att.uploadedAt instanceof Date
                      ? att.uploadedAt.toLocaleDateString()
                      : String(att.uploadedAt);

                  return (
                    <div
                      key={att.id}
                      data-testid={`attachment-item-${att.id}`}
                      className="flex items-center justify-between rounded-md border border-border p-2.5 text-xs bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        {getFileIcon(att.mimeType, att.name)}
                        <div className="truncate">
                          <p className="font-medium text-foreground truncate">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatFileSize(att.size)} • {dateStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {att.url && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <a
                              data-testid={`download-attachment-${att.id}`}
                              href={att.url}
                              download={att.name}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          data-testid={`delete-attachment-${att.id}`}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAttachment(att.id)}
                          aria-label="Delete attachment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </aside>
  );
}
