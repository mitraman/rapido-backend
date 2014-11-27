rapido-backend
==============

Private backend server for the Rapido app

The Plan
========
the single page front app is in a public repo.  This is the private backend code that stores the data, user accounts, etc.  People can still use the frontend by mocking the backend or writing their own, but I wanted to keep some control over the server-side implementation

Right now the code and API are both pretty ugly.  I want to do the following in the near future:

1.  refactor the code base into uServices
2.  setup a deployment pipeline with docker
3.  redesign the API (using Rapido) to be more extensible and easier to write frontends for.
