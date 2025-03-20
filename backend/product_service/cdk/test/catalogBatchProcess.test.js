const { handler } = require("../../lambda/catalogBatchProcess");
const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");

// Mock AWS SDK clients
jest.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    TransactWriteItemsCommand: jest.fn(),
  };
});

jest.mock("@aws-sdk/client-sns", () => {
  return {
    SNSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    PublishCommand: jest.fn(),
  };
});

// Mock UUID
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid"),
}));

describe("catalogBatchProcess Lambda", () => {
  let dynamoDBSendMock, snsSendMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocks from AWS SDK
    dynamoDBSendMock = require("@aws-sdk/client-dynamodb").DynamoDBClient()
      .send;
    snsSendMock = require("@aws-sdk/client-sns").SNSClient().send;

    // Ensure mocks resolve successfully
    dynamoDBSendMock.mockResolvedValue({});
    snsSendMock.mockResolvedValue({});

    // Mock AWS Credentials
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";

    // Environment variables for tables and SNS topic
    process.env.PRODUCTS_TABLE = "ProductsTable";
    process.env.STOCKS_TABLE = "StocksTable";
    process.env.SNS_TOPIC_ARN =
      "arn:aws:sns:us-east-1:123456789012:createProductTopic";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should process SQS messages and save products to DynamoDB", async () => {
    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: "Test Product",
            description: "This is a test product",
            price: 99.99,
            count: 10,
          }),
        },
      ],
    };

    const response = await handler(mockEvent);

    expect(dynamoDBSendMock).toHaveBeenCalledTimes(1);
    expect(dynamoDBSendMock).toHaveBeenCalledWith(
      expect.any(TransactWriteItemsCommand)
    );

    expect(snsSendMock).toHaveBeenCalledTimes(1);
    expect(snsSendMock).toHaveBeenCalledWith(expect.any(PublishCommand));

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Products saved successfully!" }),
    });
  });

  it("should handle errors when DynamoDB fails", async () => {
    dynamoDBSendMock.mockRejectedValueOnce(new Error("DynamoDB Error"));

    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: "Test Product",
            description: "This is a test product",
            price: 99.99,
            count: 10,
          }),
        },
      ],
    };

    const response = await handler(mockEvent);

    expect(dynamoDBSendMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      statusCode: 500,
      body: JSON.stringify({ error: "DynamoDB Error" }),
    });

    expect(snsSendMock).not.toHaveBeenCalled();
  });

  it("should handle errors when SNS fails", async () => {
    snsSendMock.mockRejectedValueOnce(new Error("SNS Error"));

    const mockEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: "Test Product",
            description: "This is a test product",
            price: 99.99,
            count: 10,
          }),
        },
      ],
    };

    const response = await handler(mockEvent);

    expect(dynamoDBSendMock).toHaveBeenCalledTimes(1);
    expect(snsSendMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      statusCode: 500,
      body: JSON.stringify({ error: "SNS Error" }),
    });
  });
});
