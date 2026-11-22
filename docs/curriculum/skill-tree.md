# Grade 7 skill tree

Design specification, not yet wired into gameplay. IDs are stable content identifiers. Every prerequisite is a recommended incoming edge, not a mandatory lock. Review can be assigned independently. Required variants are authoring checklists; do not award full-node coverage from one variant.

Numeric answers alone cannot complete this catalog. See the implementation contract in the main curriculum document.

## Review

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| review.add | Addition | Entry | Review | facts; make ten; within 100; larger whole numbers; missing addends; mental strategies |
| review.subtract | Subtraction | Entry | Review | facts; within 100; larger whole numbers; missing differences; mental strategies |
| review.multiply | Multiplication facts | Entry | Review | sampled multiplication facts across six mixed-table groups |
| review.divide | Division facts | Entry | Review | sampled division facts across six mixed-table groups; zero dividend; never zero divisor |
| review.whole | Whole-number operations | review.add, review.subtract, review.multiply, review.divide | Review | missing factors and dividends; multiples of ten; multi-digit multiplication; whole-number division; related equations |
| review.factors | Factors and multiples | review.multiply | Review | factors; multiples; common factors; common multiples |
| review.fractions | Fraction representations | review.factors | Review | equivalence; simplify; compare and order; mixed and improper forms |
| review.conversions | Fraction decimal percent equivalence | review.fractions | Review | fraction to decimal; decimal to fraction; decimal to percent and back; fraction to percent and back; compare and order decimals; estimates |
| review.numberline | Rational-number sense | review.fractions | Review | opposites; absolute value; compare and order signed numbers; locate fractions and decimals on number lines |
| review.expressions | Expression foundations | review.whole | Review | order of operations; evaluate by substitution; combine like terms; distributive property; expression versus equation |
| review.coordinate | Coordinate plane | review.numberline | Review | ordered pairs; all four quadrants; axis scales; independent and dependent quantities |
| review.area | Area foundations | review.fractions | Review | rectangle; square; parallelogram; triangle; trapezoid; perpendicular height; square units |
| review.angles | Angle foundations | Entry | Review | complementary; supplementary; vertical; triangle sum |
| review.data | Data foundations | review.conversions | Review | mean; median; range; IQR; quartiles; clusters; gaps; symmetry; reading single dot and box plots |
| review.onestep | One-step equations and inequalities | review.expressions, review.numberline | Review | inverse operations; equality; inequality symbols; boundary points; number-line solutions |

## Number

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| number.sets | Rational-number set relationships | review.numberline | 7.2 | nested set diagrams; membership versus containment; whole numbers within integers within rationals; natural-number convention stated |
| number.integer-add | Signed addition and subtraction | review.add, review.subtract | 7.3A | same signs; different signs; subtract negatives; models connected to algorithms |
| number.integer-multiply | Signed multiplication and division | review.multiply, review.divide | 7.3A | sign combinations; zero; nonzero divisors |
| number.decimal | Decimal operations | review.conversions, number.integer-add, number.integer-multiply | 7.3A | all four operations; positive and negative decimals |
| number.fraction | Fraction operations | review.fractions, number.integer-add, number.integer-multiply | 7.3A | all four operations; unlike denominators; signed fractions; mixed numbers |
| number.mixed | Mixed rational expressions | number.decimal, number.fraction, review.expressions | 7.3A | mixed representations; multiple operations; parentheses; estimates |
| number.context | Rational-number applications | number.mixed | 7.3B | temperature; balances; elevation; multistep situations; explain and check results |

## Ratio

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| ratio.equivalent | Ratios and ratio tables | review.fractions | 7.4D | part to part; part to whole; equivalent ratios; missing table entries; proportions |
| ratio.unit | Unit rates | ratio.equivalent | 7.4B | fractional rates; money per unit; compare prices; interpret units |
| ratio.constant | Constant of proportionality | ratio.unit, review.coordinate | 7.4C | k from tables; graphs; equations; contexts; y/x only where x is nonzero |
| ratio.represent | Constant-rate representations | ratio.constant | 7.4A | pictures; tables; words; numbers; graphs; equations; move between representations; proportional versus nonproportional examples |
| ratio.travel | Distance rate and time | ratio.represent | 7.4A | solve for d; r; t; compatible units |
| ratio.solve | Multistep ratio and rate situations | ratio.unit, number.context | 7.4D | missing values; comparisons; chained rates; contextual interpretation |
| ratio.units | Between-system conversions | ratio.unit | 7.4E | customary to metric; metric to customary; supplied conversion factors; proportions and unit rates; within-system review |

## Percent

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| percent.parts | Percent part whole and rate | review.conversions, ratio.equivalent | 7.4D | find part; find whole; find percent; visual percent models |
| percent.change | Percent change | percent.parts | 7.4D | increase; decrease; find new amount; find original amount; original amount as denominator |
| percent.multistep | Multistep percent applications | percent.change | 7.4D | successive changes; discount then tax; compare offers; distinguish percent from percentage points |

## Similar

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| similar.attributes | Similarity relationships | ratio.equivalent, review.angles | 7.5A | corresponding sides and angles; angle agreement; ratios within each figure and between figures; nonexamples |
| similar.lengths | Scale factors and missing sides | similar.attributes, ratio.solve | 7.5C | enlargement; reduction; corresponding side lengths; indirect height problems |
| similar.drawings | Scale drawings | similar.lengths, ratio.units | 7.5C | actual distance; drawing distance; create a drawing; complete a drawing; stated scale and units |

## Chance

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| chance.space | Sample spaces | review.multiply | 7.6A | simple and compound events; organized lists; construct and complete tree diagrams; ordered outcomes |
| chance.theoretical | Theoretical probability | chance.space, review.fractions | 7.6D, 7.6I | simple and compound events; equally likely outcomes stated; favorable over total; predictions for repeated trials |
| chance.complement | Events and complements | chance.theoretical | 7.6E | not event; sum to one; impossible and certain events |
| chance.experimental | Experimental probability | review.conversions | 7.6C, 7.6I | simple and compound trials; frequencies; probability estimates; predicted counts |
| chance.simulate | Select and run simulations | chance.space, chance.experimental | 7.6B | simple and compound events; physical tools; technology; fairness; repeated trials; record outcomes |
| chance.compare | Experiment predictions and comparisons | chance.theoretical, chance.simulate | 7.6H, 7.6C, 7.6D, 7.6I | qualitative and quantitative comparisons; observed versus theoretical results; sample variation; predictions supported by experiment data |

## Stats

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| stats.graphs | Graph comparisons and equivalence | review.data, percent.parts | 7.6G | bar graphs; dot plots; circle graphs; part to whole; part to part; fractions and percents; compute from graphs |
| stats.groups | Compare distributions | review.data | 7.12A | comparative dot plots and box plots; shape; center; spread; same versus different scales; support comparisons with evidence |
| stats.sample | Population inferences | stats.graphs | 7.6F, 7.12B | random sample; sample versus population; estimate counts and proportions; uncertainty; avoid unsupported certainty |
| stats.populations | Compare populations | stats.sample, stats.groups | 7.12C | two random samples; informal comparative conclusions; variability; limits of evidence |

## Linear

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| linear.read | Rate and initial value | ratio.represent, review.coordinate | 7.7 | tables; graphs; contexts; rise over run; starting value; units; proportional special case |
| linear.represent | Connect linear representations | linear.read, review.expressions | 7.7 | words; tables; graphs; equations simplifying to y=mx+b; generate and match representations; interpret m and b |

## Algebra

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| algebra.check | Check proposed solutions | review.onestep, number.mixed | 7.11B | two-step equations and inequalities; rational values; true and false candidates |
| algebra.equation | Model and solve two-step equations | review.onestep, number.mixed | 7.11A | concrete and pictorial models; rational coefficients and constants; inverse operations; check solution |
| algebra.inequality | Model and solve two-step inequalities | algebra.equation, review.onestep | 7.11A | strict and inclusive bounds; negative coefficients; reverse relation when appropriate; contextual integer answers |
| algebra.write | Write constraints as mathematics | algebra.equation, algebra.inequality | 7.10A | two-step equations; two-step inequalities; variables and units; realistic constraints |
| algebra.story | Create a corresponding situation | algebra.write | 7.10C | choose a matching story; write an original story for an equation; write an original story for an inequality |
| algebra.graph | Represent solution sets | algebra.equation, algebra.inequality | 7.10B | point for equation solution; open or closed boundary; ray direction; rational boundary; create and interpret number lines |

## Geometry

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| geometry.angles | Build and solve angle equations | algebra.equation, review.angles | 7.11C | triangle sum; complementary; supplementary; vertical; diagram to equation; multistep angle relationships |

## Circle

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| circle.pi | Circle ratio and formula models | ratio.unit, review.area | 7.5B, 7.8C | radius and diameter; circumference divided by diameter; measurement estimates; circumference model; rearranged area model; explain formula connections |
| circle.measure | Circle measurements | circle.pi, number.decimal | 7.9B | circumference and area; radius or diameter given; reverse problems; state pi approximation and rounding |

## Area

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| area.composite | Composite area | review.area, circle.measure | 7.9C | combine or subtract; rectangles; squares; parallelograms; trapezoids; triangles; semicircles; quarter circles; decomposition; missing dimensions |

## Solid

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| solid.prism | Prism volume | review.area, number.fraction | 7.9A | rectangular and triangular prisms; base area times perpendicular height; cubic units; contextual problems |
| solid.models | Prism and pyramid volume models | solid.prism | 7.8A, 7.8B | congruent bases and heights; rectangular models; triangular models; physical or virtual comparison; explain verbally and symbolically; connect to formulas |
| solid.pyramid | Pyramid volume | solid.models | 7.9A | rectangular and triangular pyramids; one third base area times height; perpendicular height versus slant height |
| solid.nets | Read and construct nets | review.area | 7.9D | rectangular prism; triangular prism; rectangular pyramid; triangular pyramid; bases versus lateral faces; supplied face heights |
| solid.surface | Lateral and total surface area | solid.nets, area.composite | 7.9D | all four solid types; sum lateral face areas; sum all face areas; net dimensions; covering versus capacity |

## Finance

| ID | Skill | Recommended prerequisites | TEKS | Required variants |
|---|---|---|---|---|
| finance.tax | Purchase and wage taxes | percent.parts | 7.13A | sales tax; total after sales tax; income tax on stated wages and supplied rate; no live tax-law assumptions |
| finance.budget | Personal budget | percent.parts | 7.13B | income; college savings; retirement savings; emergency savings; taxes; fixed and variable expenses; each category percent of total budget; organize allocations |
| finance.networth | Assets liabilities and net worth | number.context | 7.13C | classify; create and organize records; construct net worth statement; positive and negative net worth |
| finance.household | Family budget estimator | finance.budget, ratio.unit | 7.13D | use an estimator with stated location and household assumptions; minimum household costs; average hourly wage; stated workers and work hours; dated source data |
| finance.simple | Simple interest | percent.parts | 7.13E | principal; rate; time; interest versus balance; consistent time units |
| finance.compound | Compound interest comparison | finance.simple, number.decimal | 7.13E | period-by-period balances; compounding schedule; simple versus compound earnings with matched conditions; rounding policy |
| finance.deals | Compare incentives | percent.multistep, finance.tax | 7.13F | sales; rebates; coupons; combinations; restrictions and order stated; compare final cost and savings |

## Coverage index

These are design alignments, not official standard wording or certification of implemented coverage. One node can support multiple expectations; an expectation can require several nodes. The seven process expectations are tracked across problems rather than as seven unlocks.

| TEKS | Nodes |
|---|---|
| 7.2 | number.sets |
| 7.3A | number.integer-add, number.integer-multiply, number.decimal, number.fraction, number.mixed |
| 7.3B | number.context |
| 7.4A | ratio.represent, ratio.travel |
| 7.4B | ratio.unit |
| 7.4C | ratio.constant |
| 7.4D | ratio.equivalent, ratio.solve, percent.parts, percent.change, percent.multistep |
| 7.4E | ratio.units |
| 7.5A | similar.attributes |
| 7.5B | circle.pi |
| 7.5C | similar.lengths, similar.drawings |
| 7.6A | chance.space |
| 7.6B | chance.simulate |
| 7.6C | chance.experimental, chance.compare |
| 7.6D | chance.theoretical, chance.compare |
| 7.6E | chance.complement |
| 7.6F | stats.sample |
| 7.6G | stats.graphs |
| 7.6H | chance.compare |
| 7.6I | chance.theoretical, chance.experimental, chance.compare |
| 7.7 | linear.read, linear.represent |
| 7.8A | solid.models |
| 7.8B | solid.models |
| 7.8C | circle.pi |
| 7.9A | solid.prism, solid.pyramid |
| 7.9B | circle.measure |
| 7.9C | area.composite |
| 7.9D | solid.nets, solid.surface |
| 7.10A | algebra.write |
| 7.10B | algebra.graph |
| 7.10C | algebra.story |
| 7.11A | algebra.equation, algebra.inequality |
| 7.11B | algebra.check |
| 7.11C | geometry.angles |
| 7.12A | stats.groups |
| 7.12B | stats.sample |
| 7.12C | stats.populations |
| 7.13A | finance.tax |
| 7.13B | finance.budget |
| 7.13C | finance.networth |
| 7.13D | finance.household |
| 7.13E | finance.simple, finance.compound |
| 7.13F | finance.deals |
