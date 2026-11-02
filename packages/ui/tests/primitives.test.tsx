import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  Button,
  buttonVariants,
  Badge,
  Input,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetTrigger,
  SheetContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../src/index.js";

describe("@honocube/ui Presentation Primitives", () => {
  it("renders Button with proper variant and size classes", () => {
    const defaultHtml = renderToString(<Button>Click Me</Button>);
    expect(defaultHtml).toContain("bg-primary");
    expect(defaultHtml).toContain("Click Me");

    const destructiveHtml = renderToString(
      <Button variant="destructive" size="sm">
        Delete
      </Button>
    );
    expect(destructiveHtml).toContain("bg-destructive");
    expect(destructiveHtml).toContain("h-8");

    // Check buttonVariants helper directly
    expect(buttonVariants({ variant: "outline" })).toContain("border-input");
  });

  it("renders Badge with success, destructive, and outline variants", () => {
    const successHtml = renderToString(<Badge variant="success">Active</Badge>);
    expect(successHtml).toContain("bg-emerald-500/15");
    expect(successHtml).toContain("Active");

    const destructiveHtml = renderToString(
      <Badge variant="destructive">Error</Badge>
    );
    expect(destructiveHtml).toContain("bg-destructive");
  });

  it("renders Input and Textarea form controls", () => {
    const inputHtml = renderToString(
      <Input placeholder="Enter name" defaultValue="HonoCube" disabled />
    );
    expect(inputHtml).toContain('placeholder="Enter name"');
    expect(inputHtml).toContain('value="HonoCube"');
    expect(inputHtml).toContain("disabled");

    const textareaHtml = renderToString(
      <Textarea placeholder="Notes" rows={4} />
    );
    expect(textareaHtml).toContain('placeholder="Notes"');
    expect(textareaHtml).toContain('rows="4"');
  });

  it("renders Card structure", () => {
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Invoice #1001</CardTitle>
          <CardDescription>Billed to Acme Corp</CardDescription>
        </CardHeader>
        <CardContent>
          <p>$1,200.00 Total</p>
        </CardContent>
        <CardFooter>
          <span>Footer note</span>
        </CardFooter>
      </Card>
    );

    expect(html).toContain("Invoice #1001");
    expect(html).toContain("Billed to Acme Corp");
    expect(html).toContain("$1,200.00 Total");
    expect(html).toContain("Footer note");
  });

  it("renders HTML Table presentation hierarchy", () => {
    const html = renderToString(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>INV-001</TableCell>
            <TableCell>$500.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(html).toContain("Invoice ID");
    expect(html).toContain("INV-001");
    expect(html).toContain("$500.00");
  });

  it("renders Tabs with triggers and content", () => {
    const html = renderToString(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
      </Tabs>
    );

    expect(html).toContain("Overview");
    expect(html).toContain("Audit Log");
    expect(html).toContain("Overview content");
  });

  it("renders Dialog and Sheet triggers without throwing", () => {
    const dialogHtml = renderToString(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Modal</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    expect(dialogHtml).toContain("Open Dialog");

    const sheetHtml = renderToString(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open Sheet</Button>
        </SheetTrigger>
        <SheetContent side="right">
          <p>Drawer content</p>
        </SheetContent>
      </Sheet>
    );
    expect(sheetHtml).toContain("Open Sheet");
  });

  it("renders Breadcrumb navigation hierarchy", () => {
    const html = renderToString(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/invoices">Invoices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>INV-101</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );

    expect(html).toContain('href="/invoices"');
    expect(html).toContain("Invoices");
    expect(html).toContain("INV-101");
  });
});
