> The take-home prompt from Drive Capital, kept verbatim as the source of truth for the requirements. Don't edit it (`.oxfmtrc.json` keeps the formatter off it too). Where the prompt is unclear, the interpretation goes in the README's [Assumptions and edge cases](../README.md#assumptions-and-edge-cases), and `test/docs/prompt.test.ts` runs the example below exactly as written.

---

# Drive Capital Software Engineer Code Sample

We're excited to continue the interview process with you!

We're trying to simulate, as best as possible within the constraints of an interview, what it would be like to work together. Here, we're simulating how you'd build a product feature, and if we advance to later stages, we'll also get to do code review and iterative enhancements.

## Guidelines

Please keep the following guidelines in mind:

1. We want to be respectful of your time, so spend as much time as makes sense for you. Spending any less or more time is not an indication of the quality of the solution. If something comes up and you just need a bit more time, please don't hesitate to let us know. Life happens, we get it. If you get stuck and aren't able to finish:
    1. We still want to see your submission! The goal is to have some of your work to talk about in the interview.
    1. Please submit your work and explain in a README what felt challenging and how you tried to solve the problem.
    1. It's more important for us to learn how you approach problem solving than to receive a "perfect" submission.
1. Please pick your strongest, most comfortable programming language and tools.
    1. Do not pick a language in our tech stack just because we use it. In the real day-to-day work we want to simulate, you'd already be familiar with the stack, so choose what you know best today.
    1. LLMs are tools just like Vim and VSCode are tools. If you'd use them for real work, you may use them here. You're equally responsible for the code you submit at work no matter how you built it.
1. Even though this is a toy problem, we want to see how you build quality software, so consider design tradeoffs as you would for a product rather than a one-off tool.

## Requirements

The team at Drive uses Herbie, our internal platform, to build and analyze our interpersonal network. Herbie works diligently to discover information about the people we're talking to and the companies at which those people work. We can use Herbie to answer questions like:

- Who do we know who works at ACME Co?
- Who is the person we know best at ACME Co?
- Who at Drive can introduce me to the CEO of ACME Co?

We can answer these questions by analyzing the relationships between people in our network. The code sample we're asking you to solve is an abbreviated version of this problem set. At a high level, the code sample will ingest a file which contains everything Herbie knows about Drive's network and provide some insights into that network. Please see the list of requirements below :arrow_down:

1. Write a program that processes a list of commands. Each line of input will be one command. There are four types of commands, each consisting of space-separated words. A word consists of the upper- and lowercase characters A thru z.
    1. `Partner <Name>`
        1. This declares the existence of a Partner. A partner is an employee of a company named "Drive Capital".
    1. `Company <Name>`
        1. This declares the existence of a Company that isn't Drive Capital.
    - `Employee <Name> <CompanyName>`
        1. This declares the existence of an Employee that works at a previously declared company.
        1. To make the problem simpler, you can assume that when an employee is declared, the company referenced will be previously declared in the input.
        1. Employee names are globally unique i.e. There cannot be a Sarah that works at Hooli and ACME.
    1. `Contact <EmployeeName> <PartnerName> <ContactType: [email|call|coffee]>`
        1. This declares an interaction between a member of Drive Capital and an employee of company.
        1. We use contacts to figure out who at Drive has communicated with people at different companies.
        1. The program should only accept the contact types `email`, `call`, or `coffee`.
        1. Example: `Contact Ollie Masha call` means that Masha, a Partner at Drive, spoke on the phone with Ollie.
1. You may assume the input is well-formed and has no incorrectly-formatted lines. Add as much or as little error handling as you feel is appropriate.
1. The program must be executable via the command line. You can choose whether to accept input via a file name, STDIN, or both, as long as you tell us how to run it. For example:
    1. File Name: `ruby analyze_network.rb input.txt`
    1. STDIN: `cat input.txt | ruby analyze_network.rb`
        1. STDIN is more relevant on macOS / Linux. We suggest ignoring this option if you are using a different OS.
1. The program must print its output to the console.
1. The output of the program is a list of all Companies, sorted alphabetically. Each Company should list the Partner with the strongest relationship to it and the Partner's relationship strength to that Company.
    1. A Partner's relationship to a Company is defined as the total amount of Contacts between a Partner and all Employees of the Company.
1. Each line of the output should be structured as follows:
    1. `<CompanyName>: <PartnerName> (<RelationshipStrength>)`
    1. If we have no relationship to a company, the line should be: `<CompanyName>: No current relationship`.
1. Along with your solution, please include a README. The README should have:
    1. Instructions on how to build, run, and test your submission.
    1. A brief explanation of how you approached the problem and any design decisions made.
        1. We're all still learning how LLM tools fit into our workflow, so if you used them, please share how you approached using them for this project.
    1. Any assumptions your code makes about the input data or any possible edge cases you may discover.
        1. If an instruction is unclear, please reach out or document in the README your interpretation of the discrepancy.

Putting all that together, here's an example input and expected output :arrow_down:

```
# input.txt - NOTE: There will not be a comment in the actual input, this is simply for demonstration purposes
Partner Chris
Partner Molly
Company Globex
Company ACME
Employee Laurie Globex
Company Hooli
Employee Abdi Hooli
Employee Jamie Globex
Contact Laurie Chris email
Contact Laurie Molly call
Partner Rezzan
Contact Abdi Molly email
Contact Laurie Chris coffee
```

Let's say the solution was written with ruby. We'd expected it to work like :arrow_down:

```bash
$ ruby analyze_network.rb input.txt
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```
