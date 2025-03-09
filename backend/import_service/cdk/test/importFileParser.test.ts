// Set environment variables before any imports
process.env.PRODUCTS_TABLE = "test-products-table";  // Changed from PRODUCTS_TABLE_NAME
process.env.STOCKS_TABLE = "test-stocks-table";      // Changed from STOCKS_TABLE_NAME
process.env.BUCKET_NAME = "XXXXXXXXXXX";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../../lambda/importFileParser";
import { S3Event } from "aws-lambda";
import { Readable } from "stream";

// Create mock functions
const mockS3Send = jest.fn();
const mockDynamoDBSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({
    send: mockS3Send
  })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({
    ...params,
    command: "GetObject"
  }))
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockDynamoDBSend
    }))
  },
  PutCommand: jest.fn().mockImplementation((params) => ({
    ...params,
    command: "Put"
  }))
}));

describe("importFileParser Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup S3 mock response
    mockS3Send.mockResolvedValue({
      Body: Readable.from([
        'Title,Description,Price,Count\n',
        'Test Product,Test Description,99.99,10\n'
      ])
    });

    // Setup DynamoDB mock response
    mockDynamoDBSend.mockResolvedValue({});
  });

  const mockEvent: S3Event = {
    Records: [
      {
        s3: {
          bucket: { name: process.env.BUCKET_NAME },
          object: { key: "test-key.csv" },
        },
        eventTime: new Date().toISOString(),
        eventName: "ObjectCreated:Put",
        eventSource: "aws:s3",
        awsRegion: "us-east-1",
      } as any,
    ],
  } as any;

  it("should process CSV and store data in DynamoDB", async () => {
    const response = await handler(mockEvent);

    // Verify S3 command was created correctly
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: process.env.BUCKET_NAME,
      Key: "test-key.csv"
    });

    // Verify DynamoDB operations
    expect(mockDynamoDBSend).toHaveBeenCalledTimes(2);
    expect(PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: process.env.PRODUCTS_TABLE,
        Item: expect.objectContaining({
          title: "Test Product",
          description: "Test Description",
          price: 99.99
        })
      })
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.products).toHaveLength(1);
  });

  it("should return 400 for invalid event", async () => {
    const response = await handler({} as any);
    expect(response.statusCode).toBe(400);
  });

  it("should return 500 if S3 getObject fails", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("S3 Error"));
    const response = await handler(mockEvent);
    expect(response.statusCode).toBe(500);
  });

  it("should return 500 if DynamoDB put fails", async () => {
    mockDynamoDBSend.mockRejectedValueOnce(new Error("DynamoDB Error"));
    const response = await handler(mockEvent);
    expect(response.statusCode).toBe(500);
  });
});
