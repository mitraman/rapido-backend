## POST /login
Autehnticate a rapido user.  Returns an authentication token.

### Request

Send a request with the username and password in a basic auth header
```
HTTP
Authentication:  (username + password)
```
### Response

```
HTTP 200 ok
{
  "token" : "blah"
}
```

## GET /projects
Requires an auth. token

### Request
Filters?

### Response

```
HTTP 200 ok
{
  "projects" : [
    {
      "id": "2039",
      "name": "project name",
      "style": "CRUD",      
      "created": "2017-02-08T11:34:38Z",
      "modified": "2017-02-08T11:34:38Z",
      "description": "a sample project"
    },
    ...
  ]
}
```

## POST /projects
Create a new sketch project.
Requires an auth. token.  
### Request
```
HTTP POST /projects
{
  "name": "new project name",
  "description": "my project",
  "style": "CRUD"
}
```

### Response
```
HTTP 200 OK
{
  "id": "2042",
  "name": "new project name",
  "style": "CRUD",      
  "created": "2017-02-08T11:34:38Z",
  "modified": "2017-02-08T11:34:38Z",
  "description": "my project"
}
```

## GET /projects/{id}
Retrieve an individual project.
Requires an auth.token.  

### Response
```
HTTP 200 OK
{
  "id": "2042",
  "name": "new project name",
  "style": "CRUD",      
  "created": "2017-02-08T11:34:38Z",
  "modified": "2017-02-08T11:34:38Z",
  "description": "my project"
}
```

## GET /projects/{id}/vocabulary
Retrieve vocabulary list for this project
Requires an auth.token.

### Response
```
HTTP 200 OK
{
  "words": ["accounts", "customer", "href"],
  "metrics": {
    "count": "3",
    "orphan-count": "1",
    "most-frequent": "accounts"
  }
}
```

## GET /projects/{id}/vocabulary/{word}
Retrieve details for a specific vocabulary word
Requires an auth.token.

### Request
The word paramter should be made url safe using URI encoding as specified by https://tools.ietf.org/html/rfc3986#section-2.1

### Response
```
HTTP 200 OK
{
  "words": "accounts",
  "usage": {
    "total-count" : "38",
    "count-by-iteration" : {
      "1": "14",
      "2": "12",
      "3": "12"
    }
    "used-by": [
      {
        "???"
      },
      {

      }
    ]
  }
}
```


## GET /projects/{id}/sketches
Retrieve project sketches.
Requires an auth.token.  

### Response
```
HTTP 200 OK
{
  "???"
}
```
