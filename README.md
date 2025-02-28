# shop-aws-backend

## 📌 Project Overview

This project is a **backend service** for managing products in an **AWS-based e-commerce system**. It is implemented using **AWS Lambda, DynamoDB, API Gateway, and AWS CDK**.

## 🚀 Features

- ✅ **DynamoDB Integration** - Uses NoSQL database for storing product and stock data.
- ✅ **Lambda Functions** - Serverless architecture with AWS Lambda.
- ✅ **API Gateway** - Secure and scalable REST API endpoints.
- ✅ **Unit Tests** - Ensures functionality correctness.
- ✅ **CDK Deployment** - Infrastructure as code for easy deployment.
- ✅ **Swagger Documentation** - Provides API reference for easy integration.

---

## 💁️ Project Structure

```bash
backend/product_service
├── bin/                  # CDK Application Entry
├── cdk.out/              # CDK Output Directory
├── lambda/               # AWS Lambda Handlers
│   ├── createProduct.js  # Lambda Function to Create Product
│   ├── getProductsList.js # Lambda Function to Retrieve Products List
│   ├── getProductsById.js # Lambda Function to Retrieve Product by ID
├── test/                 # Unit Tests
│   ├── createProducts.test.ts
│   ├── getProductsList.test.ts
│   ├── getProductsById.test.ts
├── node_modules/         # Project Dependencies
├── package.json          # Node.js Dependencies & Scripts
├── tsconfig.json         # TypeScript Configuration
├── jest.config.js        # Jest Configuration
├── openapi.yaml          # API Specification
├── README.md             # Project Documentation
```

## 🔧 Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS CDK installed (`npm install -g aws-cdk`)

## 🚚 Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/Nadzey/shop-aws-backend.git
   cd backend/product_service
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

## 🌐 Running the Project

### Deploying the Infrastructure

To deploy AWS resources:

```sh
cdk deploy
```

This command will deploy the necessary Lambda functions, API Gateway, and DynamoDB tables.

## 🛠️ API Endpoints

### Get Product List

```http
GET /products
```

Response:

```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "price": "number",
    "count": "integer"
  }
]
```

### Get Product by ID

```http
GET /products/{productId}
```

Response:

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "price": "number",
  "count": "integer"
}
```

### Create Product

```http
POST /products
```

Request:

```json
{
  "title": "Product Name",
  "description": "Product Description",
  "price": 19.99,
  "count": 5
}
```

Response:

```json
{
  "message": "Product created successfully!",
  "id": "uuid"
}
```

## 🎲 Running Unit Tests

To run Jest unit tests:

```sh
npm test
```

This runs tests inside the `test/` directory to verify Lambda function logic.

## 📁 Database Operations

To seed test data into DynamoDB:

```sh
node seed.js
```

To manually insert a product:

```sh
aws dynamodb put-item --table-name products --item '{"id": {"S": "uuid"}, "title": {"S": "Sample Product"}, "price": {"N": "20.99"}}'
```

## ❌ Cleanup

To remove all deployed resources:

```sh
cdk destroy
```

## 📅 Notes

- Ensure AWS credentials are configured correctly before deploying.
- Use API Gateway URL for testing deployed Lambda functions.

---

## Swagger documentation
- [https://app.swaggerhub.com/apis-docs/twistertransllc/product-service_api/1.0.0](https://app.swaggerhub.com/apis-docs/twistertransllc/product-service_api/1.0.0)

## 🎨 Maintained by

**Nadzeya Kaluzayeva**
