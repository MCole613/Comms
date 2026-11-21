/**
 * FormDefs.gs — the request, design feedback and change forms.
 *
 * Copied from the original Google Forms (same questions, help text, choices
 * and branching). Edit freely: the app renders whatever is defined here.
 * Item ids like "promo.title" map to the request field after the dot.
 */

var FORMS = {
  "request": {
    "title": "Calvary Communications & Design Request",
    "sections": [
      {
        "pageId": "",
        "title": "Calvary Communications & Design Request",
        "help": "One form for every communications and design request. Every request is reviewed, assigned a tier, and scheduled. Remember our rule: One Story + One Next Step.\n\nHow much time we need for Promoting an event or ministry: \nLevel 1 Ministry/Event: At least 12 weeks out\nLevel 2 Ministry/Event: At least 5-7 weeks out\nLevel 3 Ministry/Event: At least 5-7 weeks out\nLevel 4 Ministry/Event: At least 3 weeks out\nSermon series: At least 10 weeks before the series starts.\nGraphic design only: At least 3 weeks before you need the final design.\nNeed it sooner? Submit anyway and say comment that in the form. We will do our best, but rushed requests may get a lighter plan or unable to fulfill request.",
        "items": [
          {
            "id": "ministry",
            "title": "Ministry / department",
            "help": "",
            "kind": "dropdown",
            "required": true,
            "choices": [
              {
                "value": "Guest Services"
              },
              {
                "value": "LifeGroups"
              },
              {
                "value": "Calvary Kids"
              },
              {
                "value": "Calvary Students"
              },
              {
                "value": "Calvary Young Adults"
              },
              {
                "value": "Worship / Production"
              },
              {
                "value": "NextGen Groups"
              },
              {
                "value": "Calvary Cares"
              },
              {
                "value": "Pastoral / Staff"
              },
              {
                "value": "Other"
              }
            ]
          },
          {
            "id": "kind",
            "title": "What do you need?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Promoting an event or ministry (communications, plus design if needed)",
                "nav": {
                  "type": "GO_TO_PAGE",
                  "page": "audience-the-ask"
                }
              },
              {
                "value": "Sermon series",
                "nav": {
                  "type": "GO_TO_PAGE",
                  "page": "sermon-series-details"
                }
              },
              {
                "value": "Graphic design only (t-shirt, logo, flyer, etc. - no communications plan)",
                "nav": {
                  "type": "GO_TO_PAGE",
                  "page": "graphic-design-only"
                }
              }
            ]
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "sermon-series-details",
        "title": "Sermon series details",
        "help": "One series = one big idea and one next step.",
        "items": [
          {
            "id": "series.title",
            "title": "Series title (working title is fine)",
            "help": "",
            "kind": "short",
            "required": true
          },
          {
            "id": "series.bigIdea",
            "title": "Big idea in one sentence",
            "help": "",
            "kind": "paragraph",
            "required": true
          },
          {
            "id": "series.scripture",
            "title": "Main scripture / theme / book or resource it is based on",
            "help": "",
            "kind": "short",
            "required": false
          },
          {
            "id": "series.eventDate",
            "title": "Series launch date (first Sunday)",
            "help": "",
            "kind": "date",
            "required": true
          },
          {
            "id": "series.seriesWeeks",
            "title": "Number of weeks",
            "help": "",
            "kind": "short",
            "required": true
          },
          {
            "id": "series.weeklyTitles",
            "title": "Weekly sermon titles and scriptures (if known)",
            "help": "\"TBD\" is fine. The designer will build a template that works for any title.",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "series.oneNextStep",
            "title": "What ONE next step goes with this series?",
            "help": "Example: \"Invite a friend,\" \"Join a LifeGroup,\" or \"Take the 7-day challenge.\" One action only.",
            "kind": "paragraph",
            "required": true
          },
          {
            "id": "series.visualDirection",
            "title": "Visual direction (mood, colors, imagery, anything to avoid)",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "series.designItems",
            "title": "What needs to be designed?",
            "help": "STANDARD SIZES (you do not need to type these; the designer uses them):\n- Series key art, title slide, weekly sermon slides, lobby screens: 1920 x 1080 px (16:9)\n- Social graphics: feed 1080 x 1080 px, story 1080 x 1920 px, banner / Facebook cover 1920 x 1005 px\n- YouTube thumbnails: 1280 x 720 px. Podcast art: 3000 x 3000 px\n- Invite cards / handouts: 4 x 6 in with 0.125 in bleed, 300 dpi, print-ready PDF\n- EDDM Invites: 6.25 x 8 with a 0.125 bleed, 300 dpi, print ready PDF\nNeed something different? Say so in the box below.",
            "kind": "checkbox",
            "required": true,
            "choices": [
              {
                "value": "Series key art / main graphic"
              },
              {
                "value": "Series title slide & weekly sermon slide template"
              },
              {
                "value": "Weekly sermon graphics (all weeks)"
              },
              {
                "value": "Social graphics (feed, story, banner)"
              },
              {
                "value": "YouTube thumbnails & podcast art"
              },
              {
                "value": "Lobby screens / digital sign"
              },
              {
                "value": "Invite cards"
              },
              {
                "value": "EDDM Invites"
              },
              {
                "value": "Other (explain below)"
              }
            ]
          },
          {
            "id": "series.designSpecs",
            "title": "Sizes, print specs, or text that must appear",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "series.inspiration",
            "title": "Inspiration or reference links",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "series.anythingElse",
            "title": "Anything else we should know?",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "series.nextStepType",
            "title": "What kind of next step is it?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Invite a friend",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Join a LifeGroup",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Serve",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Give",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Take a challenge / do something this week",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Other",
                "nav": {
                  "type": "SUBMIT"
                }
              }
            ]
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "graphic-design-only",
        "title": "Graphic design only",
        "help": "Design requests only. No communications plan, timeline, or promotion will be created.",
        "items": [
          {
            "id": "design.title",
            "title": "What are we making? (example: youth camp t-shirt)",
            "help": "",
            "kind": "short",
            "required": true
          },
          {
            "id": "design.whoFor",
            "title": "What is it for, and who is it for?",
            "help": "",
            "kind": "paragraph",
            "required": true
          },
          {
            "id": "design.designItems",
            "title": "What type of design is it?",
            "help": "STANDARD SIZES (you do not need to type these; the designer uses them):\n- T-shirt / apparel: vector artwork (AI or PDF), print area up to 12 x 14 in\n- Logo / icon: vector (SVG or AI) plus transparent PNG\n- Flyer / poster: flyer 8.5 x 11 in; poster 11 x 17 in; 300 dpi, 0.125 in bleed, print-ready PDF\n- Banner / signage: tell us the final physical size; we design it at full scale\n- Social graphic: feed 1080 x 1080 px, story 1080 x 1920 px\n- Slide / screen graphic: 1920 x 1080 px\n- Print piece: card 4 x 6 in, handout 5.5 x 8.5 in, program 8.5 x 11 in; 300 dpi, 0.125 in bleed\n\nNeed something different? Say so in the box below.",
            "kind": "checkbox",
            "required": true,
            "choices": [
              {
                "value": "T-shirt / apparel"
              },
              {
                "value": "Logo / icon"
              },
              {
                "value": "Flyer / poster"
              },
              {
                "value": "Banner / signage"
              },
              {
                "value": "Social graphic"
              },
              {
                "value": "Slide / screen graphic"
              },
              {
                "value": "Print piece (card, handout, program)"
              },
              {
                "value": "Other (explain below)"
              }
            ]
          },
          {
            "id": "design.designSpecs",
            "title": "Sizes, quantities, colors, and printer or vendor details",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "design.textToInclude",
            "title": "Exact text that must appear (and any logos or images to include)",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "design.inspiration",
            "title": "Inspiration or reference links",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "design.eventDate",
            "title": "Date you need the finished files",
            "help": "Allow at least two weeks if you can.",
            "kind": "date",
            "required": true
          },
          {
            "id": "design.anythingElse",
            "title": "Anything else the designer should know?",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "design.textFinal",
            "title": "Is the text final?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Yes",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "Not yet",
                "nav": {
                  "type": "SUBMIT"
                }
              },
              {
                "value": "I need help writing it",
                "nav": {
                  "type": "SUBMIT"
                }
              }
            ]
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "audience-the-ask",
        "title": "Audience & the ask",
        "help": "",
        "items": [
          {
            "id": "promo.title",
            "title": "Event or initiative name",
            "help": "",
            "kind": "short",
            "required": true
          },
          {
            "id": "promo.whoFor",
            "title": "Who is this for?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Level 1 - Whole church + community"
              },
              {
                "value": "Level 2 - A core repeatable next step (LifeGroups, Serving, Giving, Calvary 101, Baptism...)"
              },
              {
                "value": "Level 3 - All NextGen (Calvary Kids, Calvary Students, Calvary Young Adults)"
              },
              {
                "value": "Level 4 - Everything else"
              }
            ]
          },
          {
            "id": "promo.reach",
            "title": "How much of the church is this relevant to?",
            "help": "Count everyone it touches: kids + parents + volunteers all count. Be honest; the 50% Rule decides how big the push is.",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Under 25%"
              },
              {
                "value": "25-49%"
              },
              {
                "value": "50-79%"
              },
              {
                "value": "80%+"
              }
            ]
          },
          {
            "id": "promo.bridge",
            "title": "Is this a \"bridge\" event designed to invite first-time guests or the community?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Yes"
              },
              {
                "value": "No"
              }
            ]
          },
          {
            "id": "promo.nextStepType",
            "title": "What is the ONE next step you want people to take?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Sign up / register"
              },
              {
                "value": "Attend"
              },
              {
                "value": "Give"
              },
              {
                "value": "Serve"
              },
              {
                "value": "Just be aware (no action)"
              }
            ]
          },
          {
            "id": "promo.oneNextStep",
            "title": "Describe that one next step in a sentence",
            "help": "Example: \"Sign up for a LifeGroup in Church Center.\" One action only.",
            "kind": "paragraph",
            "required": true
          },
          {
            "id": "promo.story",
            "title": "Share one story or human moment that shows why this matters",
            "help": "Stories move people; facts and details do not. Who changed? What happened?",
            "kind": "paragraph",
            "required": true
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "dates-details",
        "title": "Dates & details",
        "help": "",
        "items": [
          {
            "id": "promo.eventDate",
            "title": "Event / launch date",
            "help": "Event day, or the day sign-ups close / the launch happens.",
            "kind": "date",
            "required": true
          },
          {
            "id": "promo.timeLocation",
            "title": "Time and location",
            "help": "",
            "kind": "short",
            "required": false
          },
          {
            "id": "promo.registration",
            "title": "Does this need registration in PCO / Church Center?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Yes"
              },
              {
                "value": "No"
              },
              {
                "value": "Not sure"
              }
            ]
          },
          {
            "id": "promo.details",
            "title": "Key details (cost, ages, what to bring, deadlines)",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "promo.needsDesign",
            "title": "Do you need graphic design for this?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Yes",
                "nav": {
                  "type": "GO_TO_PAGE",
                  "page": "design-details"
                }
              },
              {
                "value": "No",
                "nav": {
                  "type": "GO_TO_PAGE",
                  "page": "last-thing"
                }
              }
            ]
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "design-details",
        "title": "Design details",
        "help": "",
        "items": [
          {
            "id": "promo.designItems",
            "title": "What needs to be designed?",
            "help": "STANDARD SIZES (you do not need to type these; the designer uses them):\n- Main graphic / key art: 1920 x 1080 px (16:9)\n- Social graphics: feed 1080 x 1080 px (square), story/reel 1080 x 1920 px, Facebook event cover 1920 x 1005 px\n- Stage / lobby screen slides: 1920 x 1080 px\n- Invite cards / print: 4 x 6 in with 0.125 in bleed, 300 dpi, print-ready PDF\n- Video bumper / motion: 1920 x 1080 px, MP4, 5 to 10 seconds\n\nNeed something different? Say so in the box below.",
            "kind": "checkbox",
            "required": true,
            "choices": [
              {
                "value": "Main graphic / key art"
              },
              {
                "value": "Social graphics"
              },
              {
                "value": "Stage / lobby screen slides"
              },
              {
                "value": "Invite cards / print"
              },
              {
                "value": "Video bumper / motion"
              },
              {
                "value": "Other (explain below)"
              }
            ]
          },
          {
            "id": "promo.designSpecs",
            "title": "Sizes, print specs, or text that must appear",
            "help": "",
            "kind": "paragraph",
            "required": false
          },
          {
            "id": "promo.inspiration",
            "title": "Inspiration or reference links",
            "help": "",
            "kind": "paragraph",
            "required": false
          }
        ],
        "after": {
          "type": "CONTINUE"
        }
      },
      {
        "pageId": "last-thing",
        "title": "Last thing",
        "help": "",
        "items": [
          {
            "id": "promo.anythingElse",
            "title": "Anything else we should know?",
            "help": "",
            "kind": "paragraph",
            "required": false
          }
        ],
        "after": {
          "type": "SUBMIT"
        }
      }
    ]
  },
  "feedback": {
    "title": "Request design changes",
    "sections": [
      {
        "pageId": "",
        "title": "Calvary Design Feedback",
        "help": "Tell the designer what to change. List everything in this one message so the designer gets it as a single round.",
        "items": [
          {
            "id": "kind",
            "title": "What kind of change is this?",
            "help": "",
            "kind": "radio",
            "required": true,
            "choices": [
              {
                "value": "Fixing a mistake (typo, date, time, name)"
              },
              {
                "value": "Changing the design (look, layout, photos, colors)"
              },
              {
                "value": "Adding or removing something"
              }
            ]
          },
          {
            "id": "text",
            "title": "What needs to change? (list everything in this one message)",
            "help": "Be specific: where on the design, and what it should say or look like instead. Add links to any photos or files.",
            "kind": "paragraph",
            "required": true
          }
        ],
        "after": {
          "type": "SUBMIT"
        }
      }
    ]
  },
  "change": {
    "title": "Something changed",
    "sections": [
      {
        "pageId": "",
        "title": "Calvary Communications: Change Request",
        "help": "Use this if something changed after you submitted the request.",
        "items": [
          {
            "id": "changes",
            "title": "What is changing?",
            "help": "",
            "kind": "checkbox",
            "required": true,
            "choices": [
              {
                "value": "Event or launch date"
              },
              {
                "value": "Design details"
              },
              {
                "value": "Communications details (audience, story, next step)"
              },
              {
                "value": "Cancel this request"
              },
              {
                "value": "Other"
              }
            ]
          },
          {
            "id": "newDate",
            "title": "New date (if the date is changing)",
            "help": "",
            "kind": "date",
            "required": false
          },
          {
            "id": "details",
            "title": "Tell us what changed",
            "help": "",
            "kind": "paragraph",
            "required": true
          }
        ],
        "after": {
          "type": "SUBMIT"
        }
      }
    ]
  }
};
