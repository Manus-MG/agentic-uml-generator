import { Request, Response } from 'express';
import { UML_DIAGRAM_MODELS } from '../data/umlDiagrams.js';

export const getDiagramTypes = (req: Request, res: Response) => {
  try {
    const structureDiagrams = UML_DIAGRAM_MODELS.filter(
      (d) => d.category === 'Structure'
    );

    const behaviorGeneralDiagrams = UML_DIAGRAM_MODELS.filter(
      (d) => d.category === 'Behavior' && d.subcategory !== 'Interaction'
    );

    const interactionDiagrams = UML_DIAGRAM_MODELS.filter(
      (d) => d.subcategory === 'Interaction'
    );

    res.status(200).json({
      success: true,
      total: UML_DIAGRAM_MODELS.length,
      data: UML_DIAGRAM_MODELS,
      categories: {
        structure: {
          title: 'Structure Diagrams',
          count: structureDiagrams.length,
          items: structureDiagrams
        },
        behavior: {
          title: 'Behavior Diagrams',
          count: behaviorGeneralDiagrams.length,
          items: behaviorGeneralDiagrams
        },
        interaction: {
          title: 'Interaction Diagrams (Behavior Subset)',
          count: interactionDiagrams.length,
          items: interactionDiagrams
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve diagram types';
    res.status(500).json({
      success: false,
      message
    });
  }
};
