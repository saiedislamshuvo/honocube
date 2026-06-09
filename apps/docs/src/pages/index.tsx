import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomeFeatures from '@site/src/components/Home';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import useBaseUrl from '@docusaurus/useBaseUrl';

import styles from './index.module.css';

const codeExample = `import { createApp, DrizzleAdapter } from "@honocube/api";
import { db } from "./db";

export const { defineResource, defineApi } = createApp({
  adapter: new DrizzleAdapter(db),
});

export const posts = defineResource({
  name: "posts",
  table: postsTable,
  validator: z.object({ title: z.string() }),
});`;

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container hero-container">
        <div className="hero-text">
          <Heading as="h1" className="hero__title">
            <img 
              src={useBaseUrl('/img/logo.svg')} 
              alt="Honocube Logo" 
              className="hero__logo"
            />
            <span>{siteConfig.title}</span>
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="/docs/intro">
              Get Started
            </Link>
            <Link
              className="button button--outline button--lg margin-left--md"
              to="https://github.com/saiedislamshuvo/honocube">
              View on GitHub
            </Link>
          </div>
        </div>

        <div className="hero-code">
          <div className="home-code-block">
            <CodeBlock language="typescript">
              {codeExample}
            </CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Type-Safe Resource Framework`}
      description="Honocube is a lightweight, type-safe resource framework built on top of Hono and Drizzle ORM.">
      <HomepageHeader />
      <main>
        <HomeFeatures />
      </main>
    </Layout>
  );
}
