import { readCourseBank, type BankQuestion } from "../mentalist/bank";
import type { CourseGrade } from "../mentalist/model";
import type { ReviewCase, ReviewWorld } from "./model";

type Sample = { level: string; slot: number; focus?: string; workedExample?: boolean };
type Checkpoint = { title: string; note: string; samples: Sample[] };
type Chapter = { title: string; checkpoints: Checkpoint[] };

const samples = (level: string, ...slots: number[]): Sample[] => slots.map(slot => ({ level, slot }));
const checkpoint = (title: string, note: string, ...examples: Sample[]): Checkpoint => ({
  title, note, samples: examples,
});
const chapter = (title: string, ...checkpoints: Checkpoint[]): Chapter => ({ title, checkpoints });

const grades: Record<CourseGrade, Chapter[]> = {
  6: [
    chapter("Rational numbers",
      checkpoint("Signed numbers", "The minus sign should be readable. Check that the keypad accepts a signed result and the number line respects its displayed scale.",
        ...samples("g6.steps-multiply.1", 2, 3), ...samples("g6.steps-order.1", 2, 6)),
      checkpoint("Fraction and decimal entry", "Watch which part of the fraction is selected. A mathematically equivalent fraction should get the simplification message when needed. Check decimal place entry and the displayed units.",
        ...samples("g6.steps-fraction-products.2", 1, 5, 9), ...samples("g6.opposites.1", 3, 6, 9)),
      checkpoint("Integer models and comparisons", "Count the equal groups and check that the recorded equation represents negative chips. On the comparison items, read whether the prompt asks for least or greatest.",
        ...samples("g6.steps-multiply.2", 3, 6), ...samples("g6.steps-multiply.4", 3, 6), ...samples("g6.steps-order.2", 1, 2, 3))),
    chapter("Ratios and relationships",
      checkpoint("Ratio tables and choices", "Check that table labels identify the missing outputs. Preserve the same rate in every row. For a part-to-whole ratio, include both parts in the whole.",
        { level: "g6.steps-ratios.3", slot: 1, workedExample: true }, ...samples("g6.steps-ratios.3", 2, 3), ...samples("g6.ratios.1", 2, 5, 8)),
      checkpoint("Benchmark percents", "Count equal parts of the whole. Grid, strip, and number-line examples should keep their conventions clear. In comparison questions, expect both ordering and equality.",
        { level: "g6.steps-percent-models.1", slot: 1, focus: "Read the hundred grid." },
        { level: "g6.steps-percent-models.1", slot: 2, focus: "Identify the shaded share of the strip." },
        { level: "g6.steps-percent-models.1", slot: 3, focus: "Read the marked benchmark from the 0%–100% line." },
        ...samples("g6.steps-percent-models.4", 1, 2, 3)),
      checkpoint("Scaled axes and plotting", "Read the axes and their units before answering. Check that horizontal and vertical coordinates stay in order and a negative or half-step point snaps to the expected place.",
        ...samples("g6.steps-coordinates.2", 1, 2, 3), ...samples("g6.coordinates.1", 1, 2, 3),
        ...samples("g6.steps-variables.1", 1, 2))),
    chapter("Equations and geometry",
      checkpoint("Number-line solutions", "An equation uses one point. An inequality uses a boundary, endpoint, and direction. Check strict versus inclusive endpoints and whether the preview points the right way.",
        ...samples("g6.steps-solve.3", 1, 2), ...samples("g6.steps-inequalities.3", 1, 2),
        ...samples("g6.steps-inequalities.4", 1, 3), ...samples("g6.inequalities.1", 2, 5)),
      checkpoint("Equation stories", "The starting amount, action, and result must describe the displayed equation together. Check that each field label makes sense with every choice.",
        ...samples("g6.write-equations.1", 3, 6, 9)),
      checkpoint("Prism nets and surface area", "Opposite rectangular faces should have equal areas. Identify which faces are bases and add only the faces the question requests.",
        ...samples("g6.steps-nets.1", 1, 2, 3), ...samples("g6.steps-nets.4", 1, 2, 4))),
    chapter("Data displays and finance",
      checkpoint("Dot plots", "Every observation contributes one dot. Check that a zero count leaves the tick empty and the display stays editable until it is checked.",
        ...samples("g6.steps-dot-stem.2", 1, 2, 3)),
      checkpoint("Stem-and-leaf plots", "Every observation belongs in the correct row. The leaves should be ordered, and the display should preserve the selected leaves for both stems.",
        ...samples("g6.steps-dot-stem.4", 1, 2, 3)),
      checkpoint("Histograms", "Check which interval owns each boundary value. The bars should use the selected frequencies and the display should include all bins.",
        ...samples("g6.steps-histograms.2", 1, 2, 3)),
      checkpoint("Box plots", "Check that the order of the five values and the median-of-halves convention agree with the prompt. The marks must represent the five selected values.",
        ...samples("g6.steps-spread.4", 1, 2, 3)),
      checkpoint("Credit reports", "The answer should distinguish payment history, credit limit, and outstanding balance. In the worked example, check that the prompt fits above the first step.",
        { level: "g6.steps-credit.1", slot: 1, workedExample: true }, ...samples("g6.steps-credit.1", 2, 3))),
  ],
  7: [
    chapter("Rational numbers and proportions",
      checkpoint("Fractions and decimals", "Check operation signs, numerator and denominator editing, equivalent fractions, and exact decimal entry. Follow the stated precision for the context.",
        ...samples("fraction.add.2", 1, 2), ...samples("fraction.add.3", 1, 2), ...samples("finance.compound.2", 1, 2, 3)),
      checkpoint("Discount comparisons", "Recompute both savings from the original price. Check that ties and either type of winning offer are possible and that the question asks for a dollar difference.",
        ...samples("percent.multistep.3", 1, 2, 3)),
      checkpoint("Scale drawings", "Read the scale per square, then plot the opposite corner. Check that both distances use the same scale and the drawing matches the selected point.",
        ...samples("similar.drawings.3", 1, 2, 3))),
    chapter("Linear relationships and equations",
      checkpoint("Tables and equation matches", "Use the stated input in each table field. For an equation match, check every row, including the initial value. Only one choice should fit the whole table.",
        { level: "ratio.equivalent.3", slot: 1, workedExample: true }, ...samples("linear.represent.1", 1, 2, 3),
        ...samples("linear.represent.3", 1, 8, 13)),
      checkpoint("Graphs and records", "A point must satisfy the displayed equation. For a multi-point prompt, follow the specified order. Check that a description separates the rate and initial value.",
        ...samples("linear.represent.2", 1, 2, 3), ...samples("linear.represent.4", 3, 6, 9)),
      checkpoint("Two-step number-line tasks", "Solve both steps before marking the boundary. Confirm the ray direction and the open or closed endpoint, including when the boundary is a fraction.",
        ...samples("algebra.graph.1", 1, 2, 3), ...samples("algebra.graph.2", 1, 2, 3), ...samples("algebra.graph.3", 1, 2, 3)),
      checkpoint("Equation and inequality stories", "Check the rates, entry fee, and meaning of the bound. These fields build a guided story. Look for enough information to write an original story from the same rule.",
        ...samples("algebra.story.1", 1, 2, 3), ...samples("algebra.story.2", 1, 2, 3))),
    chapter("Probability and statistics",
      checkpoint("Ordered outcomes and trees", "Read the stated die range and outcome order. Confirm that the list uses the die result first and that the tree total matches the number of branches and leaves.",
        ...samples("chance.space.2", 3, 6, 9), ...samples("chance.space.3", 1, 2, 3)),
      checkpoint("Simulation and observed rates", "The trial control should reveal one outcome at a time. Count the displayed outcomes. A later comparison needs to distinguish observed rates above, equal to, and below the theoretical rate.",
        ...samples("chance.simulate.2", 1, 2, 3), ...samples("chance.compare.1", 1, 2, 3)),
      checkpoint("Box plots and population inferences", "Measure the right whisker from Q3 to the maximum. For a survey, decide whether its results apply to the observed group, estimate a larger population, or describe the whole population.",
        ...samples("stats.groups.1", 1, 2, 3), ...samples("stats.sample.2", 1, 2, 3))),
    chapter("Solids",
      checkpoint("Prism and pyramid models", "Check whether the solids share a base and height. The volumes and units should agree with the one-third relationship.",
        ...samples("solid.models.1", 1, 2), ...samples("solid.models.2", 1, 2)),
      checkpoint("Nets and surface area", "Verify the opposing rectangular faces pair correctly, the picture separates bases from lateral faces, and the key uses the requested areas only.",
        ...samples("solid.nets.1", 1, 2, 3), ...samples("solid.surface.1", 1, 2, 4))),
  ],
  8: [
    chapter("Real numbers and transformations",
      checkpoint("Repeating decimals and number lines", "Check where the repeating part begins and whether the fraction entry behaves consistently. On the number line, verify the visible tenths and tap the rounded value.",
        ...samples("g8.steps-repeat.2", 1, 2, 3), ...samples("g8.steps-estimate.2", 1, 2), ...samples("g8.estimate.1", 1, 3)),
      checkpoint("Dilations and rotations", "The dilation center must be specified. Check signs, the inverse scale, and the order requested for multiple vertices.",
        ...samples("g8.steps-dilate.3", 1, 2, 3), ...samples("g8.dilate.1", 1, 4, 7), ...samples("g8.rotate.1", 1, 3, 4)),
      checkpoint("Right triangles and nets", "Check that the cable problem supplies the right-angle assumptions and asks for a length with units. On a rectangular prism, opposite faces must pair by area.",
        ...samples("g8.missing-side.1", 2, 5, 8), ...samples("g8.steps-prism-surface.1", 1, 2, 3))),
    chapter("Linear models and systems",
      checkpoint("Tables and linear rules", "Use every table row when comparing equations. The rate and initial value must fit the same rule. Check the denominator or units in the input labels when relevant.",
        ...samples("g8.steps-linear.1", 1, 2, 3), ...samples("g8.steps-linear.3", 1, 8, 13)),
      checkpoint("Intersections and comparison stories", "Read both coordinates, then verify the same y in both rules. Check that every story field uses the same variable and describes the comparison direction.",
        ...samples("g8.steps-systems.2", 1, 2, 3), ...samples("g8.model.1", 3, 6, 9))),
    chapter("Scatterplots and samples",
      checkpoint("Constructing scatterplots", "Plot all the table rows as separate dots. Try placing the points in a different order. The same set of observations should be accepted and remain unconnected.",
        ...samples("g8.steps-scatter.1", 1, 2, 3), ...samples("g8.scatter.1", 2, 5, 8)),
      checkpoint("Comparing data and conclusions", "Check shape, whisker lengths, and the difference between a sample estimate and a population count. Check that the three examples make students read the evidence.",
        ...samples("g8.steps-scatter.2", 1, 2, 3), ...samples("g8.foundation-data.4", 1, 2, 3), ...samples("g8.steps-sampling.1", 1, 2, 3)),
      checkpoint("Repeated samples and spread", "Each draw should reveal a same-size sample. Check that the answer uses the observed counts. A size-10 sample yields percentages in steps of 10 and a size-50 sample yields steps of 2. In the worked example, check that the prompt and first step are separated.",
        ...samples("g8.sampling.1", 1, 2, 4),
        { level: "g8.steps-sampling.3", slot: 1, workedExample: true }, ...samples("g8.steps-sampling.3", 2, 3))),
    chapter("Personal finance",
      checkpoint("Loans and deposits", "Check what the calculator reports and where the question asks for rounding. For deposits, separate the starting money and contributions from earnings. Watch for prompt overlap in the worked example.",
        ...samples("g8.loans.1", 1, 4, 7),
        { level: "g8.steps-invest.1", slot: 1, workedExample: true }, ...samples("g8.steps-invest.1", 2, 3))),
  ],
};

type VerificationCatalog = { world: ReviewWorld; keys: Map<string, BankQuestion> };
const catalogs = new Map<CourseGrade, VerificationCatalog>();

export function verificationCatalog(grade: CourseGrade): VerificationCatalog {
  const cached = catalogs.get(grade);
  if (cached) return cached;
  const bank = readCourseBank(grade);
  const levels = new Map(bank.levels.map(level => [level.id, level]));
  const keys = new Map<string, BankQuestion>();
  const chapters = grades[grade].map(chapter => ({
    title: chapter.title,
    checkpoints: chapter.checkpoints.map(checkpoint => ({
      title: checkpoint.title,
      cases: checkpoint.samples.map((sample): ReviewCase => {
        const level = levels.get(sample.level);
        const questionId = level?.pool[sample.slot - 1]?.q;
        const question = questionId && bank.questions[questionId];
        if (!questionId || !question) throw new Error(`Missing verification example ${sample.level} #${sample.slot}`);
        const id = `${sample.level}:${questionId}`;
        if (keys.has(id)) throw new Error(`Duplicate verification example ${id}`);
        keys.set(id, question);
        return {
          id, level: sample.level, questionId,
          question: { prompt: question.prompt, control: question.control, visual: question.visual },
          note: sample.focus ? `${sample.focus} ${checkpoint.note}` : checkpoint.note,
          workedExample: sample.workedExample,
        };
      }),
    })),
  }));
  const catalog = { world: { grade, version: bank.version, chapters }, keys };
  catalogs.set(grade, catalog);
  return catalog;
}
