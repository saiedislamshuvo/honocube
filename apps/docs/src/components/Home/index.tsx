import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Type-Safe Resources',
    emoji: '🛡️',
    description: (
      <>
        Define your API as a collection of resources. Get full TypeScript support
        and automatic Zod validation for every endpoint.
      </>
    ),
  },
  {
    title: 'Powered by Hono & Drizzle',
    emoji: '🚀',
    description: (
      <>
        Built on the fastest web framework for the edge and the most intuitive
        TypeScript ORM. High performance meets developer happiness.
      </>
    ),
  },
  {
    title: 'Batteries Included',
    emoji: '🔋',
    description: (
      <>
        Automatic CRUD, complex relationships, file uploads, permissions, 
        searching, and filtering - all available out of the box.
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4 margin-bottom--lg')}>
      <div className={styles.featureCard}>
        <div className={styles.featureEmoji}>{emoji}</div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomeFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
