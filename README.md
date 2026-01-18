# Sixerzone Turf Booking System - Backend API

## 🏟️ Overview

A production-ready backend API for managing turf ground bookings with integrated Razorpay payment gateway. Built with Node.js, Express, PostgreSQL, and Sequelize ORM.

## ✨ Features

- **Real-time Availability**: Check ground availability for next 45 days
- **Smart Conflict Detection**: Handles Mega_Ground ↔ G1/G2 relationships
- **Razorpay Integration**: Secure payment processing with signature verification
- **Payment Status Tracking**: Comprehensive payment lifecycle management
- **Automatic Pricing**: Dynamic pricing based on weekday/weekend and time slots
- **Slot Protection**: 30-minute buffer for ongoing bookings
- **Data Validation**: Input validation at every level
- **Error Handling**: Comprehensive error handling with detailed messages

## 🗂️ Project Structure

```
backend/
├── config/
│   └── config.json          # Database configuration
├── controllers/
│   ├── bookingController.js # Legacy booking logic (not used)
│   ├── groundController.js  # Availability checking
│   └── paymentController.js # Razorpay payment handling
├── models/
│   ├── index.js            # Sequelize initialization
│   ├── ground.js           # Ground model
│   └── booking.js          # Booking model with payment fields
├── routes/
│   ├── bookings.js         # Legacy booking routes
│   ├── grounds.js          # Availability routes
│   └── payments.js         # Payment routes
├── .env.example            # Environment variables template
├── index.js                # Server entry point
└── package.json            # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **PostgreSQL**: v12 or higher
- **Razorpay Account**: For payment processing

### Installation

1. **Clone the repository**

   ```bash
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment variables**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your credentials:

   ```env
   DB_USERNAME=your_username
   DB_PASSWORD=your_password
   DB_NAME=turfdb
   DB_HOST=localhost
   DB_PORT=5432
   DB_DIALECT=postgres

   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret

   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

4. **Create PostgreSQL database**

   ```sql
   CREATE DATABASE turfdb;
   ```

5. **Start the server**

   ```bash
   npm start
   ```

   The models will auto-sync and create tables automatically.

## 📡 API Endpoints

### Ground Availability

#### Get Available Dates

```http
GET /api/grounds/get-available-dates
```

Returns next 45 days with availability flags grouped by month.

**Response:**

```json
{
  "2025-01": [
    { "date": "2025-01-15", "enabled": true },
    { "date": "2025-01-16", "enabled": false }
  ]
}
```

#### Get Available Slots

```http
GET /api/grounds/get-available-slots?date=2025-01-15
```

Returns 24-hour slots for the specified date.

**Response:**

```json
[
  { "slot": "12:00 AM to 1:00 AM", "enabled": true },
  { "slot": "1:00 AM to 2:00 AM", "enabled": false }
]
```

#### Get Available Grounds

```http
GET /api/grounds/get-available-grounds?date=2025-01-15&startHour=14
```

Returns grounds with availability for specific date and time.

**Response:**

```json
[
  { "id": 1, "name": "G1", "location": "Area A", "available": true },
  { "id": 2, "name": "G2", "location": "Area B", "available": false }
]
```

### Payment Processing

#### Create Order

```http
POST /api/payments/create-order
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "email": "john@example.com",
  "groundId": 1,
  "date": "2025-01-15",
  "startHour": 14
}
```

**Response:**

```json
{
  "success": true,
  "booking": {
    "id": 123,
    "totalAmount": 1000,
    "paymentStatus": "processing"
  },
  "order": {
    "id": "order_xyz123",
    "amount": 100000,
    "currency": "INR"
  },
  "razorpayKeyId": "rzp_test_..."
}
```

#### Verify Payment

```http
POST /api/payments/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_xyz123",
  "razorpay_payment_id": "pay_abc456",
  "razorpay_signature": "signature_hash",
  "bookingId": 123
}
```

#### Handle Payment Failure

```http
POST /api/payments/failure
Content-Type: application/json

{
  "bookingId": 123,
  "error": {
    "description": "Payment failed",
    "reason": "payment_failed"
  }
}
```

#### Cancel Booking

```http
DELETE /api/payments/cancel/123
```

## 🗃️ Database Models

### Ground Model

- **id**: Primary key
- **name**: G1, G2, or Mega_Ground
- **location**: Ground location
- **pricing**: JSON with weekday/weekend rates

**Pricing Structure:**

```json
{
  "Weekday_first_half": 1000,
  "Weekday_second_half": 1200,
  "Weekend_first_half": 1500,
  "Weekend_second_half": 1800
}
```

### Booking Model

- **Customer Info**: name, phone, email
- **Booking Details**: groundId, startTime, endTime, duration, totalAmount
- **Payment Tracking**: paymentStatus, razorpayOrderId, razorpayPaymentId, razorpaySignature
- **Payment Metadata**: paymentMethod, paymentAttempts, paymentCompletedAt, paymentFailureReason

**Payment Status:**

- `pending`: Booking created, payment not initiated
- `processing`: Payment gateway opened
- `paid`: Payment successful
- `failed`: Payment failed
- `refunded`: Payment refunded

## 🔐 Security Features

- **Signature Verification**: HMAC SHA256 signature verification for all payments
- **Double Verification**: Payment status fetched from Razorpay API
- **SQL Injection Protection**: Sequelize ORM with parameterized queries
- **CORS Protection**: Configured CORS with origin whitelist
- **Error Masking**: Sensitive error details hidden in production

## 🧪 Testing

### Test Payment Flow

1. Use Razorpay test credentials
2. Create order via `/api/payments/create-order`
3. Use test card numbers:
   - **Success**: 4111 1111 1111 1111
   - **Failure**: 4000 0000 0000 0002

## 🛠️ Development

### Available Scripts

- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon (if configured)

### Code Structure

- **Controllers**: Business logic and data processing
- **Models**: Database schema and associations
- **Routes**: API endpoint definitions
- **Middleware**: Request processing (CORS, JSON parsing, etc.)

### Best Practices Followed

- ✅ Comprehensive inline documentation
- ✅ Consistent error handling
- ✅ Input validation at every level
- ✅ Separation of concerns
- ✅ RESTful API design
- ✅ Environment-based configuration
- ✅ Production-ready code structure

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check database exists
psql -U postgres -c "\l"
```

### Port Already in Use

```bash
# Find process on port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <process_id> /F
```

### Razorpay Issues

- Verify API keys are correct
- Check test/live mode consistency
- Ensure webhook signature is valid

## 📝 Environment Variables Reference

| Variable              | Description         | Example                 |
| --------------------- | ------------------- | ----------------------- |
| `DB_USERNAME`         | PostgreSQL username | `postgres`              |
| `DB_PASSWORD`         | PostgreSQL password | `your_password`         |
| `DB_NAME`             | Database name       | `turfdb`                |
| `DB_HOST`             | Database host       | `localhost`             |
| `DB_PORT`             | Database port       | `5432`                  |
| `RAZORPAY_KEY_ID`     | Razorpay key ID     | `rzp_test_...`          |
| `RAZORPAY_KEY_SECRET` | Razorpay secret     | `your_secret`           |
| `PORT`                | Server port         | `3000`                  |
| `NODE_ENV`            | Environment         | `development`           |
| `FRONTEND_URL`        | Frontend URL        | `http://localhost:5173` |

## 📄 License

This project is part of Sixerzone Turf Booking System.

## 🤝 Support

For issues and questions, please refer to the inline documentation in the code.

---

**Version:** 1.0.0  
**Last Updated:** January 2025
