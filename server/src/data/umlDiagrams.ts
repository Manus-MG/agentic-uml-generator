export interface UMLModelDefinition {
  id: string;
  name: string;
  category: 'Structure' | 'Behavior';
  subcategory?: 'Interaction';
  summary: string;
  description: string;
  useCase: string;
}

export const UML_DIAGRAM_MODELS: UMLModelDefinition[] = [
  // Structure Diagrams (7)
  {
    id: 'class',
    name: 'Class Diagram',
    category: 'Structure',
    summary: 'Domain/API design, schemas and OO design',
    description: 'Shows classes, attributes, operations, associations, inheritance, composition/aggregation, interfaces.',
    useCase: 'Use for schemas and OO design.'
  },
  {
    id: 'object',
    name: 'Object Diagram',
    category: 'Structure',
    summary: 'Snapshot of instances at runtime',
    description: 'Shows a snapshot of instances at runtime.',
    useCase: 'Great for examples, test fixtures, and clarifying multiplicities.'
  },
  {
    id: 'component',
    name: 'Component Diagram',
    category: 'Structure',
    summary: 'High-level building blocks and interfaces',
    description: 'High-level building blocks and provided/required interfaces (ports/lollipops).',
    useCase: 'Use for service/module boundaries.'
  },
  {
    id: 'composite-structure',
    name: 'Composite Structure Diagram',
    category: 'Structure',
    summary: 'Internal wiring of a class/component',
    description: 'Internal wiring of a class/component: parts, ports, connectors.',
    useCase: 'Use when internals matter.'
  },
  {
    id: 'deployment',
    name: 'Deployment Diagram',
    category: 'Structure',
    summary: 'Runtime topology & execution environments',
    description: 'Runtime topology: nodes (devices/VMs/containers), execution environments, artifacts.',
    useCase: 'Use for ops/DevOps views.'
  },
  {
    id: 'package',
    name: 'Package Diagram',
    category: 'Structure',
    summary: 'Namespaces, layering & dependencies',
    description: 'Namespaces and dependencies.',
    useCase: 'Use for layering and modularization.'
  },
  {
    id: 'profile',
    name: 'Profile Diagram',
    category: 'Structure',
    summary: 'Customizing UML with stereotypes & rules',
    description: 'Customizing UML (stereotypes, tagged values, constraints).',
    useCase: 'Use to encode domain rules (e.g., «microservice», PII).'
  },

  // Behavior Diagrams (3)
  {
    id: 'use-case',
    name: 'Use Case Diagram',
    category: 'Behavior',
    summary: 'Actors, goals and system scope',
    description: 'Actors and goals; system scope.',
    useCase: 'Use for stakeholder alignment and feature slicing.'
  },
  {
    id: 'activity',
    name: 'Activity Diagram',
    category: 'Behavior',
    summary: 'Workflows, algorithms & business pipelines',
    description: 'Workflow/algorithms: actions, decisions, forks/joins, swimlanes, object flows.',
    useCase: 'Use for business processes and pipelines.'
  },
  {
    id: 'state-machine',
    name: 'State Machine Diagram',
    category: 'Behavior',
    summary: 'Lifecycles, states & event transitions',
    description: 'Lifecycles: states, events, guards, entry/exit actions.',
    useCase: 'Use for protocols, UI widgets, order/payment states.'
  },

  // Interaction Diagrams (Behavior Subset) (4)
  {
    id: 'sequence',
    name: 'Sequence Diagram',
    category: 'Behavior',
    subcategory: 'Interaction',
    summary: 'Time-ordered messages & request lifecycles',
    description: 'Time-ordered messages, sync/async, alt/loop fragments.',
    useCase: 'Use for API calls and request lifecycles.'
  },
  {
    id: 'communication',
    name: 'Communication Diagram',
    category: 'Behavior',
    subcategory: 'Interaction',
    summary: 'Participant links & network view',
    description: 'Same interaction as sequence but emphasizes links between participants; compact network view.',
    useCase: 'Use for visual network and participant collaboration.'
  },
  {
    id: 'interaction-overview',
    name: 'Interaction Overview Diagram',
    category: 'Behavior',
    subcategory: 'Interaction',
    summary: 'Storyboard stitching interactions with control flow',
    description: '“Storyboard” that stitches other interactions with control flow.',
    useCase: 'Use for complex multi-interaction workflows and high-level control flows.'
  },
  {
    id: 'timing',
    name: 'Timing Diagram',
    category: 'Behavior',
    subcategory: 'Interaction',
    summary: 'State/value changes over time',
    description: 'State/value over time along lifelines.',
    useCase: 'Use for real-time, hardware, SLA/timeout analysis.'
  }
];
