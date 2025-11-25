# Agentic UI Capture Engine
A generalized browser-automation agent that converts natural-language UI tasks into executable, DOM-grounded Playwright workflows, capturing screenshots of each meaningful UI state along the way.

### 🧠 What It Does

Ask it “how do I create a list in a Trello board?”

…and the system will:
1. Interpret the instruction via a Semantic Planner LLM
2. Navigate a real browser using Playwright
3. Dynamically inspect and extrapolate meaningful info from the DOM, live, between steps
4. Refine the plan into exact click / type / wait actions
5. Capture screenshots for every semantic UI state
6. Write a fully-structured dataset of the workflow
```json{
  "steps": [
    {
      "step": 1,
      "description": "Navigate to Trello",
      "action": "goto",
      "screenshot": "step_1.png"
    },
    {
      "step": 2,
      "description": "Click the 'Create' button to open the board creation menu",
      "action": "click",
      "screenshot": "step_2.png"
    },
    {
      "step": 3,
      "description": "Click the 'Create board' button to select the Create board option from the menu",
      "action": "click",
      "screenshot": "step_3.png"
    },
    {
      "step": 4,
      "description": "Wait for the 'Add a list' section to appear on the new board",
      "action": "wait",
      "screenshot": "step_4.png"
    },
    {
      "step": 5,
      "description": "Click on the 'Add a list' text box to enter a new list name.",
      "action": "click",
      "screenshot": "step_5.png"
    },
    {
      "step": 6,
      "description": "Enter the name for the new list",
      "action": "type",
      "screenshot": "step_6.png"
    }
  ]
}
```

<img width="1440" height="900" alt="step_1" src="https://github.com/user-attachments/assets/18f4eabc-61b5-4463-8cd5-e5706e0e9bda" />
<img width="1440" height="900" alt="step_2" src="https://github.com/user-attachments/assets/d3c2355b-607a-4d33-a69d-9c530ac9bb76" />
<img width="1440" height="900" alt="step_3" src="https://github.com/user-attachments/assets/f048fee5-8253-47bb-853d-aef0e25421dc" />
<img width="1440" height="900" alt="step_4" src="https://github.com/user-attachments/assets/4bf98e22-3cc0-49fb-8fec-d4780fc1af2d" />
<img width="1440" height="900" alt="step_5" src="https://github.com/user-attachments/assets/4805c300-6d4d-4e0b-9276-3f1b09a4748c" />
<img width="1440" height="900" alt="step_6" src="https://github.com/user-attachments/assets/513a6d64-413c-4644-ab9a-7329fd88119a" />
