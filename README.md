# Invitewala - Complete Platform Documentation

## Wedding Card Personalization & WhatsApp Distribution System

---

## Executive Summary

Invitewala is a comprehensive wedding invitation management platform that enables printing businesses to create personalized wedding cards at scale and distribute them via WhatsApp. The platform combines a powerful PDF personalization engine with integrated WhatsApp delivery through the WaSender API.

---

## Table of Contents

1. Platform Overview
2. Core Features
3. PDF Personalization Engine
4. Zone Editor System
5. Smart Eraser Technology
6. Typography & Language Support
7. CSV Data Management
8. WhatsApp Distribution System
9. WaSender API Integration
10. Round-Robin Batch Queue System
11. Message Types & Templates
12. Customer Management
13. Delivery Tracking & Reports
14. User Roles & Permissions
15. System Architecture
16. Workflow Process
17. Business Model

---

## 1. Platform Overview

### What is Invitewala?

Invitewala is a Business-to-Business (B2B) platform designed for wedding invitation printing businesses. It automates the process of creating personalized wedding invitations and distributing them digitally via WhatsApp.

### Target Users

- Wedding invitation printing shops
- Digital invitation service providers
- Event management companies
- Wedding planners

### Value Proposition

- Eliminate manual personalization of wedding cards
- Reduce delivery time from days to minutes
- Track delivery status in real-time
- Support regional languages (Gujarati, Hindi, etc.)
- Professional WhatsApp distribution

---

## 2. Core Features

### PDF Upload & Management
- Upload wedding card templates in PDF format
- Support for multi-page invitation cards
- High-resolution preview generation (150 DPI)
- Secure storage and session management

### Visual Zone Editor
- Interactive canvas-based zone selection
- Click and drag to define text areas
- Real-time zone preview
- Multiple zones per page
- Cross-page zone support

### Smart Background Handling
- Automatic background color detection
- Texture-preserving text removal
- Seamless text overlay
- Multiple masking modes

### Regional Language Support
- Full Gujarati script support
- Hindi Devanagari script support
- Proper text shaping with Pango
- Right-to-left and complex script handling

### CSV Guest Data Import
- Upload guest lists in CSV format
- Column detection and preview
- Map columns to zones
- Phone number column identification

### Batch PDF Generation
- Generate personalized PDFs for all guests
- Automatic file naming (GuestName.pdf)
- Progress tracking
- Error handling and retry

### WhatsApp Distribution
- Send PDFs directly to guest phone numbers
- Custom message templates
- Bulk sending capability
- Delivery status tracking

---

## 3. PDF Personalization Engine

### Overview

The PDF Personalization Engine is the core technology that powers the platform. It takes a wedding card template PDF and creates unique personalized versions for each guest.

### Processing Pipeline

The engine follows a five-step processing pipeline:

**Step 1: Template Loading**
The engine loads the original PDF template and extracts page information including dimensions, resolution, and embedded content.

**Step 2: Zone Identification**
Using the zone definitions created in the visual editor, the engine identifies exactly where personalized text should be placed on each page.

**Step 3: Background Preparation**
Before adding new text, the engine prepares the background by removing or masking existing content in the zone area using the Smart Eraser technology.

**Step 4: Text Rendering**
The engine renders the personalized text using the specified font, size, color, and alignment settings. Special care is taken for regional scripts.

**Step 5: Output Generation**
The final personalized PDF is generated and saved with an appropriate filename based on the guest's name.

### Coordinate System

The engine uses PDF points as the primary coordinate system:
- 1 inch equals 72 PDF points
- Preview images are generated at 150 DPI for display
- All zone coordinates are stored in PDF points for precision

---

## 4. Zone Editor System

### Purpose

The Zone Editor allows users to visually define areas on the PDF where personalized text will be inserted. This eliminates the need for manual coordinate entry.

### Zone Properties

Each zone has the following configurable properties:

**Identification**
- Zone ID: Unique identifier for the zone
- Zone Label: Human-readable name for reference

**Position**
- X Coordinate: Horizontal position from left edge
- Y Coordinate: Vertical position from top edge
- Width: Horizontal span of the zone
- Height: Vertical span of the zone
- Page Number: Which page the zone appears on

**Typography**
- Font Size: Text size in points
- Font Family: Typeface selection
- Ink Color: Text color in hex format

**Alignment**
- Horizontal Alignment: Left, Center, or Right
- Vertical Alignment: Top, Middle, or Bottom

**Background Handling**
- Mask Enabled: Whether to prepare background
- Mask Mode: Method of background preparation

### Zone Drawing Process

Users interact with the Zone Editor through mouse actions:

1. Position the cursor at the desired starting corner
2. Click and hold the mouse button
3. Drag to the opposite corner
4. Release to create the zone
5. Click on a zone to select and edit properties

### Manual Zone Entry

For precise positioning, users can also enter zone coordinates manually by specifying X, Y, Width, and Height values in PDF points.

### Auto-Detection Feature

An experimental auto-detection feature can suggest potential text zones based on visual analysis of the PDF, identifying areas that may contain text to be personalized.

---

## 5. Smart Eraser Technology

### Purpose

The Smart Eraser prepares zone backgrounds before new text is added, ensuring clean and professional results.

### Masking Modes

**Overlay Mode**
Text is placed directly on top of existing content without any background modification. Best for transparent or blank areas.

**Auto Sample Mode**
The engine samples colors from the zone corners and edges to determine the background color, then fills the zone with a matching solid color before adding text. Best for solid color backgrounds.

**Magic Mode**
Advanced algorithm that identifies and removes only text objects while preserving background textures and patterns. Best for textured or patterned backgrounds.

**Custom Solid Mode**
User specifies an exact color value to fill the zone background. Best when automatic detection produces unsatisfactory results.

### Background Detection Algorithm

The Auto Sample mode uses the following process:

1. Extract pixel colors from zone corners
2. Calculate median color values
3. Apply color smoothing
4. Fill zone with detected color
5. Optional feathering at edges

---

## 6. Typography & Language Support

### Regional Script Support

The platform provides full support for Indian regional scripts:

**Gujarati (ગુજરાતી)**
- Complete character set support
- Proper conjunct handling
- Vowel sign placement
- Nukta and other diacritics

**Hindi (हिंदी)**
- Devanagari script support
- Matra positioning
- Consonant clusters
- Chandrabindu and anusvara

### Text Rendering Technology

The platform uses Pango text shaping technology which provides:

- Complex script shaping
- Bidirectional text support
- Font fallback handling
- Proper line breaking
- Accurate text measurement

### Alignment System

**Gravity Logic**
A special alignment system ensures text remains properly positioned even when font sizes change:

- Vertical centering maintains consistent baselines
- Horizontal centering accounts for script characteristics
- Proportional spacing for visual balance

---

## 7. CSV Data Management

### CSV Format Requirements

The platform accepts CSV files with the following characteristics:

- UTF-8 encoding (required for regional scripts)
- Comma or tab delimited
- Header row with column names
- One row per guest

### Example CSV Structure

A typical CSV file contains:

- Guest name column (mapped to name zone)
- Phone number column (for WhatsApp delivery)
- Additional data columns (address, table number, etc.)

### Column Mapping

After uploading a CSV file, users map columns to zones:

1. System displays available columns
2. User selects which zone each column maps to
3. Phone column is identified separately for WhatsApp
4. Preview shows sample data in zones

### Data Validation

The system validates:

- Required columns are present
- Phone numbers are in valid format
- No empty values in required fields
- Character encoding is correct

---

## 8. WhatsApp Distribution System

### Overview

The WhatsApp Distribution System enables sending personalized wedding cards directly to guests' phones. The platform uses WaSender API for reliable delivery.

### Sending Methods

**Individual Send**
Send to a single recipient for testing or special cases.

**Batch Send**
Send to all guests in the CSV file with automatic throttling to comply with WhatsApp limitations.

### Message Customization

Users can customize the message sent with each card:

- Greeting text
- Guest name placeholder
- Event details
- Custom closing

### Delivery Flow

1. User initiates send from the platform
2. Platform queues all recipients
3. For each recipient:
   - PDF is prepared
   - Message is customized
   - WaSender API sends the message
   - Status is recorded
4. Delivery report is generated

---

## 9. WaSender API Integration

### Integration Model

The platform uses a centralized API model:

- Platform owner purchases WaSender subscription
- Platform owner holds the API key
- Customers connect their WhatsApp numbers to WaSender
- Cards are sent from customer's WhatsApp number
- API usage is managed by platform owner

### How It Works

**Step 1: API Configuration**
Platform administrator configures the WaSender API key in platform settings. This key authenticates all API requests.

**Step 2: Customer Session Setup**
Each customer (printing business) connects their business WhatsApp number to WaSender through the WaSender dashboard. This creates a session.

**Step 3: Session Selection**
When sending cards, the customer selects their connected WhatsApp session. This determines which phone number the cards will be sent from.

**Step 4: Card Delivery**
The platform uses the WaSender API to send cards through the customer's WhatsApp number. Guests receive cards appearing to come from the customer's business.

### API Capabilities

The WaSender API provides:

**Send Document**
Upload and send PDF files with optional caption message.

**Send Message**
Send text-only messages for reminders or follow-ups.

**Session Management**
Check connection status of WhatsApp sessions.

**Delivery Status**
Query status of sent messages.

### Rate Limiting

WaSender implements rate limits to ensure WhatsApp compliance:

- Delay between messages
- Daily sending limits
- Queue management

---

## 10. Round-Robin Batch Queue System

### Overview

The Round-Robin Batch Queue System provides fair, balanced distribution of WhatsApp messages across multiple customers. Instead of processing one customer's entire list before moving to the next, the system cycles through all active customers in rounds, ensuring equitable service for everyone.

### The Problem It Solves

**Without Round-Robin:**
- Customer A has 500 invitations, Customer B has 500, Customer C has 500
- System sends all 500 for Customer A first (takes hours)
- Customer B and C must wait until A is complete
- New customers face even longer waits

**With Round-Robin:**
- Each customer gets a batch of messages sent per cycle
- All customers make progress simultaneously
- Fair and predictable delivery times
- New customers can join immediately

### How It Works

**Cycle-Based Processing**

The system operates in continuous cycles. In each cycle:

1. Take first batch from Customer A (example: 50 invitations)
2. Take first batch from Customer B (50 invitations)
3. Take first batch from Customer C (50 invitations)
4. Cycle completes, repeat from step 1 with next batch
5. Continue until all customers' lists are exhausted

**Visual Example:**

Cycle 1:
- Customer A: Send invitations 1-50
- Customer B: Send invitations 1-50
- Customer C: Send invitations 1-50

Cycle 2:
- Customer A: Send invitations 51-100
- Customer B: Send invitations 51-100
- Customer C: Send invitations 51-100

This continues until all invitations are sent.

### Dynamic Customer Management

**Adding Customers Mid-Cycle**

New customers can be added while the system is actively sending:

- New customer joins the queue
- System includes them in the very next cycle
- No disruption to existing customers
- Seamless integration

**Example Scenario:**

During Cycle 5, a 4th customer joins:
- Cycle 5 completes with 3 customers
- Cycle 6 includes all 4 customers
- Each customer now gets their batch per cycle

**Removing or Pausing Customers**

Customers can also be:
- Paused (temporarily excluded from cycles)
- Removed (taken out of queue entirely)
- Resumed (added back to queue)

### Admin Controls

**Batch Size Adjustment**

Administrators can modify the batch size during operation:

**Scenario:** Initially set to 50 per customer per cycle

If workload increases (more customers join), admin can:
- Increase to 75 or 100 per cycle
- Faster completion for each customer
- Higher throughput overall

If system needs throttling, admin can:
- Decrease to 25 per cycle
- Slower but more distributed
- Reduced API load

**Real-Time Adjustment:**

Changes take effect from the next cycle:
- Current cycle completes with old settings
- Next cycle uses new batch size
- No messages lost or duplicated

### Queue Priority Options

While the default is equal distribution, admins can optionally configure:

**Standard Priority**
All customers get equal batch sizes per cycle.

**Weighted Priority**
Premium customers can receive larger batches:
- Standard customer: 50 per cycle
- Premium customer: 100 per cycle
- VIP customer: 150 per cycle

**Urgent Priority**
Mark specific jobs as urgent:
- Urgent jobs processed first in each cycle
- Then regular jobs continue
- Useful for time-sensitive weddings

### Queue Status Dashboard

Administrators can monitor the queue in real-time:

**Queue Overview:**
- Total customers in queue
- Total invitations remaining
- Current cycle number
- Estimated completion time

**Per-Customer Status:**
- Customer name
- Total invitations
- Sent count
- Remaining count
- Current status

**Cycle Statistics:**
- Messages sent this cycle
- Average time per cycle
- Success rate
- Failed message count

### Handling Failures

When messages fail to send:

**Automatic Retry:**
- Failed messages added to retry queue
- Retried in subsequent cycles
- Maximum retry attempts configurable

**Skip After Failures:**
- After max retries, message marked as failed
- Continues with remaining messages
- Admin notified of persistent failures

**Manual Intervention:**
- Admin can view failed messages
- Option to retry, skip, or investigate
- Detailed error information available

### Benefits of Round-Robin System

**Fairness**
All customers receive equal attention regardless of when they joined or list size.

**Predictability**
Customers can estimate when their messages will complete based on queue position and batch size.

**Flexibility**
Admin can adjust parameters based on load, time of day, or business requirements.

**Scalability**
System handles growing customer base without degradation.

**Reliability**
If one customer's messages fail, others continue unaffected.

---

## 11. Message Types & Templates

### Invitation Messages

The primary message type for sending wedding invitations:

- Includes personalized PDF attachment
- Warm greeting with guest name
- Event date and time information
- Venue details or link

### Reminder Messages

Follow-up messages sent before the event:

- Text-only or with PDF attachment
- Countdown to event
- RSVP request
- Travel directions

### Thank You Messages

Post-event appreciation messages:

- Thanks for attending
- Photo sharing links
- Memorable moments

### Custom Messages

Free-form messages for any purpose:

- Save the date announcements
- Venue changes
- Ceremony updates
- Personal notes

### Template Variables

Messages can include dynamic placeholders:

- Guest name
- Event date
- Event time
- Venue name
- Custom fields from CSV

---

## 12. Customer Management

### Customer Records

The platform maintains customer (printing business) records:

- Business name
- Contact person
- Email address
- Phone number
- Address
- Notes

### Customer WhatsApp Sessions

Each customer can have connected WhatsApp sessions:

- Session identifier
- Phone number
- Connection status
- Last used timestamp

### Customer History

Track customer activity:

- PDF templates uploaded
- Cards generated
- Messages sent
- Last active date

---

## 13. Delivery Tracking & Reports

### Real-Time Status

Track message delivery in real-time:

**Pending**
Message is queued and waiting to be sent.

**Sent**
Message was successfully sent to WhatsApp.

**Delivered**
Message was delivered to recipient's phone.

**Failed**
Message could not be sent (with error reason).

### Delivery Reports

Generate comprehensive reports showing:

- Total messages attempted
- Successful deliveries
- Failed deliveries
- Failure reasons breakdown
- Delivery timeline

### Export Options

Reports can be exported as:

- CSV file for spreadsheet analysis
- PDF for printing or sharing
- On-screen summary view

---

## 14. User Roles & Permissions

### Super Administrator

Full platform access including:

- All features
- User management
- System settings
- API configuration
- Analytics
- All customers

### Administrator

Standard management access:

- PDF personalization
- Customer management
- Reports
- Task management

### Designer

Limited access for design work:

- Customer viewing
- Task management

### Role Hierarchy

Super Administrator has all permissions of Administrator.
Administrator has all permissions of Designer.

---

## 15. System Architecture

### Frontend Layer

The user interface built with modern web technologies:

- React-based single page application
- Responsive design for all devices
- Real-time updates
- Interactive zone editor
- Dashboard with analytics

### Backend Layer

Server-side processing and API:

- FastAPI framework
- RESTful API design
- Session management
- File handling
- Database operations

### PDF Processing Layer

Core personalization engine:

- PDF parsing and manipulation
- Image rendering
- Text overlay
- Batch processing

### Integration Layer

External service connections:

- WaSender API for WhatsApp
- File storage
- Authentication

### Database Layer

Data persistence:

- User accounts
- Customer records
- Session data
- Delivery logs
- Analytics data

### Storage Layer

File management:

- Uploaded templates
- Generated previews
- Output PDFs
- Temporary files

---

## 16. Workflow Process

### Complete End-to-End Workflow

**Phase 1: Setup**
1. Customer logs into the platform
2. Customer connects WhatsApp via WaSender (one-time)
3. Admin verifies connection status

**Phase 2: Template Preparation**
1. Customer uploads wedding card PDF
2. System generates page previews
3. Customer draws zones on the PDF
4. Customer configures zone properties

**Phase 3: Data Import**
1. Customer uploads guest CSV file
2. System parses and validates data
3. Customer maps columns to zones
4. Customer identifies phone column

**Phase 4: Preview & Approval**
1. Customer generates preview with first guest
2. Customer reviews personalization quality
3. Customer adjusts zones if needed
4. Customer approves for batch generation

**Phase 5: Generation**
1. Customer initiates batch generation
2. System processes all guests
3. Personalized PDFs are created
4. Files are stored for distribution

**Phase 6: Distribution**
1. Customer selects WhatsApp session
2. Customer customizes message template
3. Customer initiates batch send
4. Cards are sent via WaSender API

**Phase 7: Tracking**
1. System tracks delivery status
2. Customer views real-time progress
3. Failed deliveries are flagged
4. Customer can retry failed sends

**Phase 8: Reporting**
1. Customer generates delivery report
2. Export report as needed
3. Follow up on failed deliveries

---

## 17. Business Model

### Platform Revenue Model

**Subscription Tiers**
Customers pay monthly/yearly subscription for platform access with different limits on:

- Number of cards per month
- Number of WhatsApp sessions
- Storage space
- Support level

**Per-Card Pricing**
Alternative or additional pricing per card generated and sent.

### Cost Structure

**WaSender API**
Platform owner pays for WaSender subscription which covers all customer usage.

**Infrastructure**
Server hosting, storage, and bandwidth costs.

**Development**
Ongoing platform development and maintenance.

### Customer Value

**Time Savings**
Reduce hours of manual work to minutes.

**Professional Quality**
Consistent, error-free personalization.

**Instant Delivery**
Digital cards reach guests immediately.

**Tracking**
Know exactly who received their invitation.

---

## Appendix A: Glossary

**Zone**: A defined rectangular area on a PDF where personalized text will be inserted.

**Session**: A connected WhatsApp number in WaSender that can be used for sending messages.

**Masking**: The process of preparing a zone background before adding new text.

**Template**: The original wedding card PDF before personalization.

**Batch**: A group of guests to receive personalized cards in one operation.

**API Key**: Secret credential for authenticating with WaSender service.

---

## Appendix B: File Specifications

### Supported PDF Formats
- PDF version 1.4 and above
- Maximum file size: 50 MB
- Color mode: RGB or CMYK
- Resolution: Any (recommended 300 DPI)

### Supported Image Formats for Preview
- PNG format at 150 DPI
- Full color support

### CSV Requirements
- UTF-8 encoding
- Comma delimited
- Maximum 10,000 rows
- Header row required

---

## Appendix C: WhatsApp Compliance

### Best Practices

- Send only to opted-in recipients
- Include business identification
- Provide opt-out mechanism
- Respect messaging hours
- Follow rate limits

### Recommended Limits

- 1-2 second delay between messages
- Maximum 200 messages per day per session
- Gradual ramp-up for new numbers

---

*Document Version: 1.0*
*Last Updated: December 2024*
