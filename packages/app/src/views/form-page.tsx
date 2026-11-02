import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Card, CardContent, CardHeader } from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { FormView } from "./form-view.js";
import type { FormPageProps } from "./types.js";

export function FormPage<TCollection extends Collection<any>>({
  collection,
  backUrl,
  onBack,
  className = "",
  title,
  description,
  actions,
  ...formProps
}: FormPageProps<TCollection>): React.JSX.Element {
  return (
    <div className={`space-y-4 max-w-5xl mx-auto py-6 px-4 sm:px-6 ${className}`}>
      {/* Back button link / action */}
      {(onBack || backUrl) && (
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{`Back to ${collection.label || "records"}`}</span>
          </Button>
        </div>
      )}

      {/* Main Form Card Container */}
      <Card>
        <CardHeader className="pb-0">
          {/* Header rendered via FormView */}
        </CardHeader>
        <CardContent className="pt-4">
          <FormView
            collection={collection}
            title={title}
            description={description}
            actions={actions}
            showHeader={true}
            showFooter={true}
            {...formProps}
          />
        </CardContent>
      </Card>
    </div>
  );
}
